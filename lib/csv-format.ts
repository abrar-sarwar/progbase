export type CsvFormat = "subscribed" | "event" | "unknown";

const EVENT_REQUIRED = ["api_id", "approval_status", "qr_code_url"] as const;
const SUBSCRIBED_HINTS = [
  "event_approved_count",
  "event_checked_in_count",
  "events_approved",
  "events_checked_in",
  "approved",
  "rsvps",
  "rsvp_count",
  "checked_in",
  "check_ins",
  "checkins",
  "attended",
  "attendance",
];

function norm(h: string): string {
  return h
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function detectFormat(rawHeaders: string[]): CsvFormat {
  const normed = new Set(rawHeaders.map(norm));
  if (EVENT_REQUIRED.every((h) => normed.has(h))) return "event";
  if (SUBSCRIBED_HINTS.some((h) => normed.has(h))) return "subscribed";
  return "unknown";
}
