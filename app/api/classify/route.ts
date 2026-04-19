import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { createClient } from "@/lib/supabase/server";
import { recordApiEvent } from "@/lib/telemetry/record";

const VALID_CONTENT_TYPES = [
  "blog_post",
  "email",
  "report",
  "proposal",
  "press_release",
  "social_post",
  "memo"
];

const DEFAULT_CONTENT_TYPE = "blog_post";

const SYSTEM_PROMPT = "You are classifying a piece of business content. Based on the text provided, identify the most likely content type from this exact list: blog_post, email, report, proposal, press_release, social_post, memo. Respond with only the content type identifier and nothing else — no explanation, no punctuation, no markdown.";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // Security: ensure user is authenticated
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ contentType: DEFAULT_CONTENT_TYPE });
    }

    const { text } = body;

    // Requirement: Empty string returns blog_post
    if (!text || !text.trim()) {
      return NextResponse.json({ contentType: DEFAULT_CONTENT_TYPE });
    }

    // Requirement: Use first 300 words only
    const first300Words = text.trim().split(/\s+/).slice(0, 300).join(" ");

    try {
      const anthropicStart = Date.now();
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Text to classify:\n\n${first300Words}` }
        ],
      });
      await recordApiEvent({
        userId: session.user.id,
        documentId: null,
        eventType: "classify",
        eventCategory: "ai",
        model: "claude-haiku-4-5-20251001",
        latencyMs: Date.now() - anthropicStart,
        usage: response.usage,
      });

      const responseContent = response.content[0];
      let content = "";
      
      if (responseContent && "text" in responseContent) {
        // Requirement: trim and lowercase
        content = responseContent.text.trim().toLowerCase();
      }

      // Requirement: If not a valid ContentType, return blog_post
      const contentType = VALID_CONTENT_TYPES.includes(content) ? content : DEFAULT_CONTENT_TYPE;

      return NextResponse.json({ contentType });
    } catch (apiError) {
      console.error("Anthropic API Error:", apiError);
      // Requirement: Never throw to client, return safe default
      return NextResponse.json({ contentType: DEFAULT_CONTENT_TYPE });
    }
  } catch (error) {
    console.error("Classification critical error:", error);
    // Requirement: Never throw to client
    return NextResponse.json({ contentType: DEFAULT_CONTENT_TYPE });
  }
}
