import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { DiagnosisResponse, LanguageVariant, ContentType } from "@/lib/anthropic/types";
import { getDiagnoseSystemPrompt } from "@/lib/anthropic/prompts/diagnose";
import { calculateSignalScore, calculateAverageScore } from "@/lib/utils/scoring";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
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
      .select("final_content")
      .eq("document_id", documentId)
      .single();

    if (cleanError || !cleanup || !cleanup.final_content) {
      return NextResponse.json(
        { error: "Document clean-up is not complete." },
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

    // 4. Send to Anthropic (same as /api/analyse but with cleaned content)
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: "user", content: cleanup.final_content }
      ],
    });

    const responseContent = message.content[0];
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    // 5. Build JSON and parse
    let textBody = responseContent.text;
    if (textBody.includes("```")) {
      textBody = textBody.replace(/```json\n?/, "").replace(/```\n?/, "");
    }

    let diagnosis: DiagnosisResponse;
    try {
      diagnosis = JSON.parse(textBody.trim());
    } catch (e) {
      console.error("Rescore JSON parse failed:", textBody, e);
      return NextResponse.json(
        { error: "Score recalculation failed", scores: null },
        { status: 500 }
      );
    }

    // 6. Calculate finalized scores
    const substance = calculateSignalScore(diagnosis.signals.substance.dimensions);
    const style = calculateSignalScore(diagnosis.signals.style.dimensions);
    const trust = calculateSignalScore(diagnosis.signals.trust.dimensions);
    const average = calculateAverageScore(substance, style, trust);

    // 7. Write final scores to diagnoses record
    const { error: updateError } = await supabase
      .from("diagnoses")
      .update({
        substance_score_final: substance,
        style_score_final: style,
        trust_score_final: trust,
        average_score_final: average
      })
      .eq("document_id", documentId);

    if (updateError) {
      console.error("Diagnosis score update error:", updateError);
      throw updateError;
    }

    // 8. Update document status to exported as per spec
    await supabase
      .from("documents")
      .update({ status: "exported", updated_at: new Date().toISOString() })
      .eq("id", documentId);

    return NextResponse.json({
      scores: {
        substance,
        style,
        trust,
        average
      }
    });

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStatus = (error as { status?: number }).status ?? "unknown";
    console.error("[CHQ-002] Anthropic API error in /api/rescore:", {
      message: errMessage,
      status: errStatus,
      model: "claude-sonnet-4-6",
    });
    return NextResponse.json(
      { error: "Score recalculation failed", scores: null },
      { status: 500 }
    );
  }
}
