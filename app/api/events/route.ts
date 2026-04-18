import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordApiEvent } from "@/lib/telemetry/record";

const ALLOWED_EVENTS = new Set([
  "screen_view",
  "pause_card_answered",
  "pause_card_skipped",
  "change_accepted",
  "change_reverted",
  "cleanup_completed",
  "export_downloaded",
]);

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { eventType, documentId, metadata } = body as {
      eventType?: string;
      documentId?: string | null;
      metadata?: Record<string, unknown>;
    };

    if (!eventType || !ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    await recordApiEvent({
      userId: session.user.id,
      documentId: documentId ?? null,
      eventType,
      eventCategory: "user",
      metadata: metadata ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/events] failed:", err);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
