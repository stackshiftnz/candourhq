import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { getCalibrationSystemPrompt } from "@/lib/anthropic/prompts/calibrate";
import { calibrateTool, CALIBRATE_TOOL_NAME } from "@/lib/anthropic/tool-schemas";
import { recordApiEvent } from "@/lib/telemetry/record";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { samples } = body;

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json({ error: "No samples provided" }, { status: 400 });
    }

    // Combine samples into a single string for analysis
    const combinedSamples = samples
      .map((s, i) => `### SAMPLE ${i + 1} ###\n${s}`)
      .join("\n\n");

    const anthropicStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: getCalibrationSystemPrompt(),
      tools: [calibrateTool],
      tool_choice: { type: "tool", name: CALIBRATE_TOOL_NAME },
      messages: [
        { role: "user", content: `Analyze these writing samples to infer my brand voice:\n\n${combinedSamples}` }
      ],
    });

    await recordApiEvent({
      userId: user.id,
      documentId: null,
      eventType: "brand_calibrate",
      eventCategory: "ai",
      model: "claude-haiku-4-5-20251001",
      latencyMs: Date.now() - anthropicStart,
      usage: response.usage,
    });

    const toolUse = response.content.find(c => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      // Fallback if tool use failed for some reason
      return NextResponse.json({ error: "AI failed to provide structured calibration data." }, { status: 500 });
    }

    return NextResponse.json(toolUse.input);

  } catch (error) {
    console.error("Calibration error:", error);
    return NextResponse.json({ error: "Failed to calibrate brand voice" }, { status: 500 });
  }
}
