import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { DiagnosisResponse, DiagnosisIssue, LanguageVariant, ContentType } from "@/lib/anthropic/types";
import { getDiagnoseSystemPrompt } from "@/lib/anthropic/prompts/diagnose";
import { calculateSignalScore, calculateAverageScore } from "@/lib/utils/scoring";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const maxDuration = 60;

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

    // Guard: only process pending documents — rejects duplicate concurrent requests
    if (document.status !== "pending") {
      return NextResponse.json({ error: "Document is not pending." }, { status: 409 });
    }

    // 2. Fetch brand profile
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

    // 3. Update status to analysing
    await supabase
      .from("documents")
      .update({ status: "analysing" })
      .eq("id", documentId);

    // 4. Build system prompt
    const systemPrompt = getDiagnoseSystemPrompt({
      languageVariant: (brandProfile?.language_variant || document.language_variant || "en-US") as LanguageVariant,
      tone: brandProfile?.tone || "direct",
      writingExamples: brandProfile?.writing_examples || [],
      bannedPhrases: brandProfile?.banned_phrases || [],
      approvedPhrases: brandProfile?.approved_phrases || [],
      contentType: document.content_type as ContentType,
    });

    // Send to Anthropic
    const systemBlock: TextBlockParam = {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" },
    };
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: [systemBlock],
      messages: [
        { role: "user", content: document.original_content }
      ],
    });
    if (message.usage) {
      console.log("[CHQ-ANALYSE] token usage:", {
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

    // 5. Strip markdown fences and parse JSON
    let textBody = responseContent.text;
    if (textBody.includes("```")) {
      textBody = textBody.replace(/```json\n?/, "").replace(/```\n?/, "");
    }
    
    let diagnosis: DiagnosisResponse;
    try {
      diagnosis = JSON.parse(textBody.trim());
    } catch (e) {
      console.error("Failed to parse diagnosis JSON. Raw output:", textBody, e);
      await supabase.from("documents").update({ status: "pending" }).eq("id", documentId);
      return NextResponse.json(
        { error: "Analysis result was corrupted. Please try again." },
        { status: 500 }
      );
    }

    // 6. Calculate average_score_original using dimensions as ground truth
    diagnosis.signals.substance.score = calculateSignalScore(diagnosis.signals.substance.dimensions);
    diagnosis.signals.style.score = calculateSignalScore(diagnosis.signals.style.dimensions);
    diagnosis.signals.trust.score = calculateSignalScore(diagnosis.signals.trust.dimensions);

    const averageOriginal = calculateAverageScore(
      diagnosis.signals.substance.score,
      diagnosis.signals.style.score,
      diagnosis.signals.trust.score
    );

    // Issue ordering: trust, substance, style
    const priorityOrder = { trust: 0, substance: 1, style: 2 };
    diagnosis.issues.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // 7. Write diagnoses record (upsert guards against concurrent duplicate requests)
    const { error: diagInsertError } = await supabase
      .from("diagnoses")
      .upsert({
        document_id: documentId,
        headline_finding: diagnosis.headline_finding,
        substance_score: diagnosis.signals.substance.score,
        substance_desc: diagnosis.signals.substance.description,
        specificity_score: diagnosis.signals.substance.dimensions.specificity,
        evidence_score: diagnosis.signals.substance.dimensions.evidence,
        info_density_score: diagnosis.signals.substance.dimensions.info_density,
        style_score: diagnosis.signals.style.score,
        style_desc: diagnosis.signals.style.description,
        generic_phrasing_score: diagnosis.signals.style.dimensions.generic_phrasing,
        repetition_score: diagnosis.signals.style.dimensions.repetition,
        readability_score: diagnosis.signals.style.dimensions.readability,
        trust_score: diagnosis.signals.trust.score,
        trust_desc: diagnosis.signals.trust.description,
        brand_match_score: diagnosis.signals.trust.dimensions.brand_match,
        certainty_risk_score: diagnosis.signals.trust.dimensions.certainty_risk,
        average_score_original: averageOriginal,
        issues: diagnosis.issues as unknown as DiagnosisIssue[],
        issue_count: diagnosis.issues.length
      }, { onConflict: "document_id", ignoreDuplicates: true });

    if (diagInsertError) {
      console.error("Diagnosis insert error:", diagInsertError);
      throw diagInsertError;
    }

    // 8. Update status to diagnosed
    await supabase
      .from("documents")
      .update({ status: "diagnosed" })
      .eq("id", documentId);

    return NextResponse.json(diagnosis);

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStatus = (error as { status?: number }).status ?? "unknown";
    console.error("[CHQ-001] Anthropic API error in /api/analyse:", {
      message: errMessage,
      status: errStatus,
      model: "claude-haiku-4-5-20251001",
    });
    if (documentId) {
      const errorSupabase = createClient();
      await errorSupabase.from("documents").update({ status: "pending" }).eq("id", documentId);
    }
    return NextResponse.json(
      { error: "Analysis failed. Your content has been saved — try again from History." },
      { status: 500 }
    );
  }
}
