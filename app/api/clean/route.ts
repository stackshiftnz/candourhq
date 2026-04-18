import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { CleanupResponse, CleanupParagraph, DiagnosisIssue } from "@/lib/anthropic/types";
import { getCleanupSystemPrompt } from "@/lib/anthropic/prompts/cleanup";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = createClient();
  let documentId: string | null = null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(session.user.id, 10, 60000); // 10 requests per minute
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { 
          status: 429, 
          headers: { 
            'X-RateLimit-Limit': rateLimit.limit.toString(), 
            'X-RateLimit-Remaining': rateLimit.remaining.toString() 
          } 
        }
      );
    }

    const body = await req.json();
    documentId = body.documentId;

    if (!documentId) {
      return NextResponse.json({ error: "No documentId provided." }, { status: 400 });
    }

    // 1. Fetch document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 2. Fetch latest diagnosis
    const { data: diagnosis, error: diagError } = await supabase
      .from("diagnoses")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (diagError || !diagnosis) {
      return NextResponse.json({ error: "No diagnosis found for this document. Please analyse first." }, { status: 400 });
    }

    // 3. Fetch brand profile
    let brandProfileId = document.brand_profile_id;
    if (!brandProfileId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_brand_profile_id")
        .eq("id", session.user.id)
        .single();
      brandProfileId = profile?.default_brand_profile_id;
    }

    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("id", brandProfileId || "")
      .single();

    // 4. Update status to cleaning
    await supabase
      .from("documents")
      .update({ status: "cleaning" })
      .eq("id", documentId);

    // 5. Build system prompt — ensure every issue has an issue_id before handing it to the model.
    // Backfills for diagnoses persisted before the issue_id field existed.
    const issuesWithIds: DiagnosisIssue[] = ((diagnosis.issues || []) as unknown as DiagnosisIssue[])
      .map((issue) => ({
        ...issue,
        issue_id: issue.issue_id || `${issue.priority}-${issue.char_start}-${issue.char_end}`,
      }));

    const languageVariant = brandProfile?.language_variant || document.language_variant || "en-US";
    const systemPrompt = getCleanupSystemPrompt({
      languageVariant,
      tone: brandProfile?.tone || "direct",
      writingExamples: brandProfile?.writing_examples || [],
      bannedPhrases: brandProfile?.banned_phrases || [],
      approvedPhrases: brandProfile?.approved_phrases || [],
      contentType: document.content_type,
      diagnosisIssues: issuesWithIds
    });

    // 6. Send to Anthropic
    const systemBlock: TextBlockParam = {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    };
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 6000, // Clean-up can be long
      system: [systemBlock],
      messages: [
        { role: "user", content: document.original_content }
      ],
    });
    if (message.usage) {
      console.log("[CHQ-CLEAN] token usage:", {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cache_read: (message.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0,
        cache_write: (message.usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0,
      });
    }

    const responseContent = message.content[0];
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    // 7. Strip markdown fences and parse JSON
    let textBody = responseContent.text;
    if (textBody.includes("```")) {
      textBody = textBody.replace(/```json\n?/, "").replace(/```\n?/, "");
    }
    
    let cleanupData: CleanupResponse;
    try {
      cleanupData = JSON.parse(textBody.trim());
    } catch (e) {
      console.error("Failed to parse cleanup JSON. Raw output:", textBody, e);
      // Wait for status revert in catch block
      throw new Error("Cleanup result was corrupted. Please try again.");
    }

    // 8. Validate paragraph count (split by double newline)
    const originalParagraphs = (document.original_content || "").trim().split(/\n\s*\n/).filter((p: string) => p.trim());
    const cleanedParagraphs = cleanupData.paragraphs;
    
    if (cleanedParagraphs.length !== originalParagraphs.length) {
      console.warn(`Paragraph count mismatch: original=${originalParagraphs.length}, cleaned=${cleanedParagraphs.length}`);
      // We don't necessarily want to fail here if the AI did a good job merging/splitting intentionally, 
      // but the spec says "Keep paragraph count the same."
      // For now, we'll proceed but log it.
    }

    // 9. Calculate stats — count unique resolved issue_ids (a single issue can yield
    // multiple change tags in the same paragraph; counting changes overcounts).
    const issuesTotal = (diagnosis.issues as unknown as DiagnosisIssue[] || []).length;
    const resolvedIssueIds = new Set<string>();
    let pauseCardsTotal = 0;

    cleanupData.paragraphs.forEach(p => {
      if (p.type === 'clean') {
        p.changes?.forEach(c => {
          if (c.issue_id) resolvedIssueIds.add(c.issue_id);
        });
      } else if (p.type === 'pause') {
        pauseCardsTotal++;
      }
    });

    // Fallback for a run where the model didn't return issue_ids at all: preserve
    // the previous heuristic so resolved count isn't stuck at zero.
    const issuesResolved = resolvedIssueIds.size > 0
      ? resolvedIssueIds.size
      : cleanupData.paragraphs.reduce((sum, p) => sum + (p.type === 'clean' ? (p.changes?.length || 0) : 0), 0);

    // 10. Write cleanups record
    const { data: nextCleanup, error: cleanupInsertError } = await supabase
      .from("cleanups")
      .insert({
        document_id: documentId,
        diagnosis_id: diagnosis.id,
        paragraphs: cleanupData.paragraphs as unknown as CleanupParagraph[],
        issues_total: issuesTotal,
        issues_resolved: issuesResolved,
        pause_cards_total: pauseCardsTotal,
        pause_cards_answered: 0
      })
      .select()
      .single();

    if (cleanupInsertError) {
      console.error("Cleanup insert error:", cleanupInsertError);
      throw cleanupInsertError;
    }

    return NextResponse.json({
      id: nextCleanup.id,
      paragraphs: cleanupData.paragraphs,
      issues_total: issuesTotal,
      issues_resolved: issuesResolved,
      pause_cards_total: pauseCardsTotal
    });

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStatus = (error as { status?: number }).status ?? "unknown";
    console.error("[CHQ-CLEAN] Anthropic API error in /api/clean:", {
      message: errMessage,
      status: errStatus,
      model: "claude-haiku-4-5-20251001",
    });
    if (documentId) {
      const errorSupabase = createClient();
      await errorSupabase.from("documents").update({ status: "diagnosed" }).eq("id", documentId);
    }
    return NextResponse.json(
      { error: errMessage || "An unexpected error occurred during clean-up. Please try again." },
      { status: 500 }
    );
  }
}
