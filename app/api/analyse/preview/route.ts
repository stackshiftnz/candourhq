import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { recordApiEvent } from "@/lib/telemetry/record";
import { PREVIEW_SYSTEM_PROMPT } from "@/lib/anthropic/prompts/preview";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { text } = await req.json();

    if (!text || !text.trim() || text.length < 50) {
      return NextResponse.json({ error: "Content too short for preview" }, { status: 400 });
    }

    // Capture first 250 words for a better quality signal
    const first150Words = text.trim().split(/\s+/).slice(0, 250).join(" ");

    const anthropicStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: PREVIEW_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Text to preview:\n\n${first150Words}` }
      ],
    });

    await recordApiEvent({
      userId: session.user.id,
      documentId: null,
      eventType: "preview_scan",
      eventCategory: "ai",
      model: "claude-sonnet-4-6",
      latencyMs: Date.now() - anthropicStart,
      usage: response.usage,
    });

    const body = response.content[0];
    if (body.type === "text") {
      try {
        // Robust JSON extraction: Strip markdown code blocks if present
        const jsonText = body.text.replace(/```json\n?|```/g, "").trim();
        const previewData = JSON.parse(jsonText);
        
        // Ensure all required fields exist
        if (!previewData.scoreRange || !previewData.headline) {
           throw new Error("Missing required preview fields");
        }
        // Default issueCount to 0 if model omits it
        if (typeof previewData.issueCount !== "number") {
          previewData.issueCount = 0;
        }
        
        return NextResponse.json(previewData);
      } catch (parseError) {
        console.error("JSON Extraction Error in Preview:", parseError, body.text);
        return NextResponse.json({ 
          error: "Analysis format error",
          fallback: true 
        }, { status: 200 }); // Return 200 with error data to aid UI handling
      }
    }

    return NextResponse.json({ error: "No analysis generated" }, { status: 200 });

  } catch (error) {
    console.error("Preview API Critical Error:", error);
    // Never allow a 500 for a "preview" feature; it should just fail silently or gracefully
    return NextResponse.json({ error: "Preview unavailable" }, { status: 200 });
  }
}
