import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { CleanupResponse, CleanupParagraph, DiagnosisIssue } from "@/lib/anthropic/types";
import { getCleanupSystemPrompt } from "@/lib/anthropic/prompts/cleanup";
import { cleanupTool, CLEANUP_TOOL_NAME } from "@/lib/anthropic/tool-schemas";
import { recordApiEvent } from "@/lib/telemetry/record";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";

export const maxDuration = 300;

// Scans the streaming tool-input JSON buffer and returns every paragraph object
// whose closing brace has already arrived. Partial trailing paragraphs are
// intentionally skipped; they'll appear on the next delta. Handles escaped
// characters and strings so braces inside content don't derail depth tracking.
function extractCompleteParagraphs(buffer: string): CleanupParagraph[] {
  const marker = '"paragraphs":[';
  const startIdx = buffer.indexOf(marker);
  if (startIdx === -1) return [];
  const results: CleanupParagraph[] = [];
  let i = startIdx + marker.length;
  let depth = 0;
  let inString = false;
  let escape = false;
  let paragraphStart = -1;
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
          } catch {
            return results;
          }
          paragraphStart = -1;
        }
      } else if (depth === 0 && ch === "]") {
        break;
      }
    }
    i++;
  }
  return results;
}

export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id, 10, 60000);
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
      .eq("id", session.user.id)
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
    }));

  const languageVariant = brandProfile?.language_variant || document.language_variant || "en-US";
  const systemPrompt = getCleanupSystemPrompt({
    languageVariant,
    tone: brandProfile?.tone || "direct",
    writingExamples: brandProfile?.writing_examples || [],
    bannedPhrases: brandProfile?.banned_phrases || [],
    approvedPhrases: brandProfile?.approved_phrases || [],
    contentType: document.content_type,
    diagnosisIssues: issuesWithIds,
  });

  const systemBlock: TextBlockParam = {
    type: "text",
    text: systemPrompt,
    cache_control: { type: "ephemeral" },
  };

  const encoder = new TextEncoder();
  const userId = session.user.id;
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

      try {
        await supabase.from("documents").update({ status: "cleaning" }).eq("id", docId);
        send("status", { status: "cleaning" });

        const anthropicStart = Date.now();
        const msgStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 6000,
          system: [systemBlock],
          tools: [cleanupTool],
          tool_choice: { type: "tool", name: CLEANUP_TOOL_NAME },
          messages: [{ role: "user", content: document.original_content }],
        });

        let jsonBuffer = "";
        let emitted = 0;

        for await (const event of msgStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "input_json_delta"
          ) {
            jsonBuffer += event.delta.partial_json;
            const paragraphs = extractCompleteParagraphs(jsonBuffer);
            while (emitted < paragraphs.length) {
              send("paragraph", { index: emitted, paragraph: paragraphs[emitted] });
              emitted++;
            }
          }
        }

        const finalMessage = await msgStream.finalMessage();
        const latencyMs = Date.now() - anthropicStart;

        await recordApiEvent({
          userId,
          documentId: docId,
          eventType: "clean",
          eventCategory: "ai",
          model: "claude-sonnet-4-6",
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
        const cleanedParagraphs = cleanupData.paragraphs;
        if (cleanedParagraphs.length !== originalParagraphs.length) {
          console.warn(
            `Paragraph count mismatch: original=${originalParagraphs.length}, cleaned=${cleanedParagraphs.length}`
          );
        }

        const issuesTotal = (diagnosis.issues as unknown as DiagnosisIssue[] || []).length;
        const resolvedIssueIds = new Set<string>();
        let pauseCardsTotal = 0;
        cleanupData.paragraphs.forEach((p) => {
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
            : cleanupData.paragraphs.reduce(
                (sum, p) => sum + (p.type === "clean" ? (p.changes?.length || 0) : 0),
                0
              );

        const { data: nextCleanup, error: cleanupInsertError } = await supabase
          .from("cleanups")
          .insert({
            document_id: docId,
            diagnosis_id: diagnosis.id,
            paragraphs: cleanupData.paragraphs as unknown as CleanupParagraph[],
            issues_total: issuesTotal,
            issues_resolved: issuesResolved,
            pause_cards_total: pauseCardsTotal,
            pause_cards_answered: 0,
            brand_profile_snapshot: brandSnapshotPayload,
          })
          .select()
          .single();

        if (cleanupInsertError) {
          throw cleanupInsertError;
        }

        send("complete", {
          id: nextCleanup.id,
          paragraphs: cleanupData.paragraphs,
          issues_total: issuesTotal,
          issues_resolved: issuesResolved,
          pause_cards_total: pauseCardsTotal,
        });
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        const errStatus = (error as { status?: number }).status ?? "unknown";
        console.error("[CHQ-CLEAN] Stream error:", {
          message: errMessage,
          status: errStatus,
          model: "claude-sonnet-4-6",
        });
        try {
          await supabase.from("documents").update({ status: "diagnosed" }).eq("id", docId);
        } catch {
          // Non-fatal — we still want to surface the stream error to the client.
        }
        send("error", { error: errMessage || "Clean-up failed. Please try again." });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed
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
