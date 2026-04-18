import { createClient } from "@/lib/supabase/client";
import type { CleanupParagraph } from "@/lib/anthropic/types";
import type { UserEdit } from "@/types/database";

export type RevisionEventType =
  | "ai_initial"
  | "user_edit"
  | "pause_resolved"
  | "pause_skipped"
  | "revert"
  | "accept_remaining";

interface WriteArgs {
  cleanupId: string;
  documentId: string;
  eventType: RevisionEventType;
  paragraphs: CleanupParagraph[];
  userEdits?: UserEdit[];
  metadata?: Record<string, unknown>;
}

// Writes an immutable snapshot of the cleanup state. Failures are logged but
// never surfaced to the user — revisions are a background audit concern.
export async function writeRevision(args: WriteArgs): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("cleanup_revisions").insert({
      cleanup_id: args.cleanupId,
      document_id: args.documentId,
      user_id: user?.id ?? null,
      event_type: args.eventType,
      paragraphs: args.paragraphs,
      user_edits: args.userEdits ?? [],
      metadata: (args.metadata ?? {}) as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[revisions] writeRevision failed:", err);
  }
}
