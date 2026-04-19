"use server";

import { createClient } from "@/lib/supabase/server-user";
import type { SampleEventMetadata } from "@/types/database";

export async function logSampleEvent(
  userId: string,
  eventType: string,
  metadata?: SampleEventMetadata
): Promise<void> {
  const supabase = await createClient();

  // Verify caller matches session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) return;

  await supabase.from("sample_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata: metadata ?? null,
  });
}
