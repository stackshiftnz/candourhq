import { NextResponse } from "next/server";
import { openai } from "@/lib/openai/client";
import { scoringFunction, SCORING_FUNCTION_NAME } from "@/lib/openai/scoring-tool";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DiagnosisResponse, LanguageVariant, ContentType } from "@/lib/anthropic/types";
import { getDiagnoseSystemPrompt } from "@/lib/anthropic/prompts/diagnose";
import { calculateSignalScore, calculateAverageScore } from "@/lib/utils/scoring";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  let documentId: string | null = null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    documentId = body.documentId;

    if (!documentId) {
      return NextResponse.json({ error: "No documentId provided." }, { status: 400 });
    }

    // 1. Fetch document and cleanup
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { data: cleanup, error: cleanError } = await supabase
      .from("cleanups")
      .select("id, final_content, paragraphs")
      .eq("document_id", documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cleanError || !cleanup) {
      return NextResponse.json(
        { error: "Document clean-up record not found." },
        { status: 400 }
      );
    }

    let finalContent = cleanup.final_content;

    // If final_content is missing, calculate it from paragraphs
    if (!finalContent && cleanup.paragraphs) {
      const paragraphs = cleanup.paragraphs as Array<{ type: string; cleaned?: string; original?: string }>;
      finalContent = paragraphs
        .map(p => {
          if (p.type === 'clean') return p.cleaned || "";
          if (p.type === 'pause') return p.original || "";
          return "";
        })
        .filter(Boolean)
        .join("\n\n");

      if (finalContent) {
        await supabaseAdmin
          .from("cleanups")
          .update({ final_content: finalContent })
          .eq("id", cleanup.id);
      }
    }

    if (!finalContent) {
      return NextResponse.json(
        { error: "Document clean-up is not complete (missing content)." },
        { status: 400 }
      );
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

    // 3. Build system prompt (same as /api/analyse)
    const systemPrompt = getDiagnoseSystemPrompt({
      languageVariant: (brandProfile?.language_variant || document.language_variant || "en-US") as LanguageVariant,
      tone: brandProfile?.tone || "direct",
      writingExamples: brandProfile?.writing_examples || [],
      bannedPhrases: brandProfile?.banned_phrases || [],
      approvedPhrases: brandProfile?.approved_phrases || [],
      contentType: document.content_type as ContentType,
    });

    // 4. Score with GPT-4o-mini at temperature=0 for deterministic output
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      seed: 42,
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: finalContent },
      ],
      tools: [{ type: "function", function: scoringFunction }],
      tool_choice: { type: "function", function: { name: SCORING_FUNCTION_NAME } },
    });

    const rawToolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!rawToolCall || rawToolCall.type !== "function" || rawToolCall.function.name !== SCORING_FUNCTION_NAME) {
      console.error("[RESCORE] Scoring function call missing. Finish reason:", completion.choices[0]?.finish_reason);
      return NextResponse.json(
        { error: "Score recalculation failed", scores: null },
        { status: 500 }
      );
    }

    const diagnosis = JSON.parse(rawToolCall.function.arguments) as DiagnosisResponse;

    // 5. Calculate finalised scores
    const substance = calculateSignalScore(diagnosis.signals.substance.dimensions);
    const style     = calculateSignalScore(diagnosis.signals.style.dimensions);
    const trust     = calculateSignalScore(diagnosis.signals.trust.dimensions);
    const average   = calculateAverageScore(substance, style, trust);

    // 6. Write final scores to diagnoses record (admin client bypasses RLS — no UPDATE policy exists)
    const { error: updateError } = await supabaseAdmin
      .from("diagnoses")
      .update({
        substance_score_final: substance,
        style_score_final:     style,
        trust_score_final:     trust,
        average_score_final:   average,
      })
      .eq("document_id", documentId);

    if (updateError) {
      console.error("[RESCORE] Diagnosis score update error:", updateError);
      throw updateError;
    }

    return NextResponse.json({
      scores: { substance, style, trust, average }
    });

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("[RESCORE] Error:", { message: errMessage, documentId });
    return NextResponse.json(
      { error: "Score recalculation failed", scores: null },
      { status: 500 }
    );
  }
}
