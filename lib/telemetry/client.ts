// Client-side analytics helper. Fires and forgets to /api/events.
// Failures never surface to the user.

export type EventType =
  | "screen_view"
  | "pause_card_answered"
  | "pause_card_skipped"
  | "change_accepted"
  | "change_reverted"
  | "cleanup_completed"
  | "export_downloaded";

export function trackEvent(
  eventType: EventType,
  documentId?: string | string[] | null,
  metadata?: Record<string, unknown>,
): void {
  const docId = Array.isArray(documentId) ? documentId[0] : documentId;
  // Fire and forget — we never block UI on telemetry
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, documentId: docId, metadata }),
    keepalive: true,
  }).catch(() => {
    // Silent — telemetry failures must never break the user flow
  });
}
