// Server-side telemetry helper. Inserts into api_events via the service-role
// Supabase client so RLS is bypassed. Failures never break the caller.

import { createClient } from "@/lib/supabase/server";
import type { Message } from "@anthropic-ai/sdk/resources/messages";

type RecordArgs = {
  userId: string | null;
  documentId: string | null;
  eventType: string;
  eventCategory: "ai" | "user" | "system";
  model?: string;
  latencyMs?: number;
  wordCount?: number;
  usage?: Message["usage"];
  metadata?: Record<string, unknown>;
};

export async function recordApiEvent(args: RecordArgs): Promise<void> {
  try {
    const supabase = await createClient();
    const usage = args.usage as
      | (Message["usage"] & {
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        })
      | undefined;

    await supabase.from("api_events").insert({
      user_id: args.userId,
      document_id: args.documentId,
      event_type: args.eventType,
      event_category: args.eventCategory,
      model: args.model ?? null,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      cache_read_tokens: usage?.cache_read_input_tokens ?? null,
      cache_write_tokens: usage?.cache_creation_input_tokens ?? null,
      latency_ms: args.latencyMs ?? null,
      word_count: args.wordCount ?? null,
      metadata: (args.metadata ?? {}) as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[telemetry] recordApiEvent failed:", err);
  }
}
