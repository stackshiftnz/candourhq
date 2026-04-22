import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { CleanupResponse, CleanupParagraph, DiagnosisIssue, RefinementAmbition } from "@/lib/anthropic/types";
import { getCleanupSystemPrompt } from "@/lib/anthropic/prompts/cleanup";
import { cleanupTool, CLEANUP_TOOL_NAME } from "@/lib/anthropic/tool-schemas";
import { recordApiEvent } from "@/lib/telemetry/record";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const maxDuration = 300;

// Tracks our position in the tool-input JSON stream so we don't re-parse 
// already-emitted paragraphs. This avoids O(N^2) CPU cost on large buffers.
function extractNewParagraphs(buffer: string, startIndex: number): { paragraphs: CleanupParagraph[], nextIndex: number } {
  const marker = '"paragraphs":[';
  let currentPos = buffer.indexOf(marker);
  if (currentPos === -1) return { paragraphs: [], nextIndex: startIndex };
  
  // Jump to the first potentially unparsed character
  currentPos = Math.max(currentPos + marker.length, startIndex);
  
  const results: CleanupParagraph[] = [];
  let i = currentPos;
  let depth = 0;
  let inString = false;
  let escape = false;
  let paragraphStart = -1;
  let lastValidIndex = startIndex;

  while (i < buffer.length) {
    const ch = buffer[i];
    if (escape) {
      escape = false;
    } else if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
      else if (ch === "{") {
        if (depth === 0) paragraphStart = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && paragraphStart !== -1) {
          const chunk = buffer.slice(paragraphStart, i + 1);
          try {
            results.push(JSON.parse(chunk) as CleanupParagraph);
            lastValidIndex = i + 1;
          } catch {
            // Partial JSON, stop here and wait for more data
            return { paragraphs: results, nextIndex: lastValidIndex };
          }
          paragraphStart = -1;
        }
      } else if (depth === 0 && ch === "]") {
        break;
      }
    }
    i++;
  }
  return { paragraphs: results, nextIndex: lastValidIndex };
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(user.id, 10, 60000);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rateLimit.limit.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        },
      }
    );
  }

  const body = await req.json();
  const documentId: string | undefined = body.documentId;
  const ambition: RefinementAmbition = body.ambition || "conservative";
  const selectedIssueIds: string[] | undefined = body.selectedIssueIds;

  if (!documentId) {
    return NextResponse.json({ error: "No documentId provided." }, { status: 400 });
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (document.status !== "diagnosed" && document.status !== "cleaning") {
    return NextResponse.json(
      { error: "Document is not ready for clean-up. Please run diagnosis first." },
      { status: 409 }
    );
  }

  const { data: diagnosis, error: diagError } = await supabase
    .from("diagnoses")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (diagError || !diagnosis) {
    return NextResponse.json(
      { error: "No diagnosis found for this document. Please analyse first." },
      { status: 400 }
    );
  }

  let brandProfileId = document.brand_profile_id;
  if (!brandProfileId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_brand_profile_id")
      .eq("id", user.id)
      .single();
    brandProfileId = profile?.default_brand_profile_id;
  }

  const { data: brandProfile } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("id", brandProfileId || "")
    .single();

  const issuesWithIds: DiagnosisIssue[] = ((diagnosis.issues || []) as unknown as DiagnosisIssue[])
    .map((issue) => ({
      ...issue,
      issue_id: issue.issue_id || `${issue.priority}-${issue.char_start}-${issue.char_end}`,
    }))
    .filter((issue) => {
      if (!selectedIssueIds || selectedIssueIds.length === 0) return true;
      return selectedIssueIds.includes(issue.issue_id!);
    });

  const languageVariant = brandProfile?.language_variant || document.language_variant || "en-US";
  const systemPrompt = getCleanupSystemPrompt({
    languageVariant,
    tone: brandProfile?.tone || "direct",
    writingExamples: brandProfile?.writing_examples || [],
    bannedPhrases: brandProfile?.banned_phrases || [],
    approvedPhrases: brandProfile?.approved_phrases || [],
    contentType: document.content_type,
    diagnosisIssues: issuesWithIds,
    ambition: ambition,
  });

  const systemBlock: TextBlockParam = {
    type: "text",
    text: systemPrompt,
    cache_control: { type: "ephemeral" },
  };

  const encoder = new TextEncoder();
  const userId = user.id;
  const docId = documentId;
  const brandSnapshotPayload = brandProfile
    ? {
        id: brandProfile.id,
        name: brandProfile.name,
        language_variant: brandProfile.language_variant,
        tone: brandProfile.tone,
        writing_examples: brandProfile.writing_examples || [],
        banned_phrases: brandProfile.banned_phrases || [],
        approved_phrases: brandProfile.approved_phrases || [],
        captured_at: new Date().toISOString(),
      }
    : null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 8_000);

      try {
        await supabase.from("documents").update({ status: "cleaning" }).eq("id", docId);
        send("status", { status: "cleaning" });

        const originalContent = (document.original_content || "").trim();
        const expectedParagraphCount = Math.max(
          originalContent.split(/\n\s*\n/).filter((p: string) => p.trim()).length,
          1
        );

        const anthropicStart = Date.now();
        const msgStream = anthropic.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 20000,
          system: [systemBlock],
          tools: [cleanupTool],
          tool_choice: { type: "tool", name: CLEANUP_TOOL_NAME },
          messages: [{ role: "user", content: document.original_content }],
        });

        let jsonBuffer = "";
        let parseIndex = 0;
        let emitted = 0;

        for await (const event of msgStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "input_json_delta"
          ) {
            jsonBuffer += event.delta.partial_json;
            const { paragraphs, nextIndex } = extractNewParagraphs(jsonBuffer, parseIndex);
            parseIndex = nextIndex;
            
            paragraphs.forEach((p) => {
              send("paragraph", { index: emitted, paragraph: p });
              emitted++;
              send("progress", { emitted, expected: expectedParagraphCount });
            });
          }
        }

        const finalMessage = await msgStream.finalMessage();
        const latencyMs = Date.now() - anthropicStart;

        await recordApiEvent({
          userId,
          documentId: docId,
          eventType: "clean",
          eventCategory: "ai",
          model: "claude-haiku-4-5-20251001",
          latencyMs,
          wordCount: document.word_count,
          usage: finalMessage.usage,
        });

        const toolUseBlock = finalMessage.content.find(
          (b) => b.type === "tool_use" && b.name === CLEANUP_TOOL_NAME
        );
        if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
          throw new Error("Cleanup result was corrupted. Please try again.");
        }
        const cleanupData = toolUseBlock.input as CleanupResponse;

        const originalParagraphs = (document.original_content || "")
          .trim()
          .split(/\n\s*\n/)
          .filter((p: string) => p.trim());
        const cleanedParagraphs = cleanupData?.paragraphs || [];
        if (cleanedParagraphs.length !== originalParagraphs.length) {
          console.warn(
            `Paragraph count mismatch: original=${originalParagraphs.length}, cleaned=${cleanedParagraphs.length}`
          );
        }

        const issuesTotal = (diagnosis.issues as unknown as DiagnosisIssue[] || []).length;
        const resolvedIssueIds = new Set<string>();
        let pauseCardsTotal = 0;
        const paragraphsArray = cleanupData?.paragraphs || [];
        paragraphsArray.forEach((p) => {
          if (p.type === "clean") {
            p.changes?.forEach((c) => {
              if (c.issue_id) resolvedIssueIds.add(c.issue_id);
            });
          } else if (p.type === "pause") {
            pauseCardsTotal++;
          }
        });
        const issuesResolved =
          resolvedIssueIds.size > 0
            ? resolvedIssueIds.size
            : paragraphsArray.reduce(
                (sum, p) => sum + (p.type === "clean" ? (p.changes?.length || 0) : 0),
                0
              );

        const { data: nextCleanup, error: cleanupInsertError } = await supabase
          .from("cleanups")
          .upsert(
            {
              document_id: docId,
              diagnosis_id: diagnosis.id,
              paragraphs: paragraphsArray as unknown as CleanupParagraph[],
              issues_total: issuesTotal,
              issues_resolved: issuesResolved,
              pause_cards_total: pauseCardsTotal,
              pause_cards_answered: 0,
            },
            { onConflict: "document_id" }
          )
          .select()
          .single();

        if (cleanupInsertError) {
          throw cleanupInsertError;
        }

        send("complete", {
          id: nextCleanup.id,
          paragraphs: paragraphsArray,
          issues_total: issuesTotal,
          issues_resolved: issuesResolved,
          pause_cards_total: pauseCardsTotal,
        });
      } catch (error: any) {
        const errMessage = error instanceof Error ? error.message : JSON.stringify(error);
        const errStatus = error?.status ?? "unknown";
        console.error("[CHQ-CLEAN] Stream failure:", {
          message: errMessage,
          status: errStatus,
          model: "claude-haiku-4-5-20251001",
          docId
        });
        
        try {
          await supabase.from("documents").update({ status: "diagnosed" }).eq("id", docId);
        } catch (dbErr) {
          console.error("[CHQ-CLEAN] Status reset failed:", dbErr);
        }
        
        send("error", {
          error: errMessage || "Clean-up failed unexpectedly.",
          phase: "generating",
          details: error instanceof Error ? error.stack?.slice(0, 200) : "No stack trace available"
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
