export type EventAttendanceRow = {
  luma_event_id: string;
  guest_api_id: string | null;
  name: string | null;
  email: string;
  registered_at: string | null;
  checked_in_at: string | null;
  approval_status: "invited" | "approved" | "declined";
};

export type ParseEventRowResult =
  | { ok: true; row: EventAttendanceRow }
  | { ok: false; reason: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_ID_RE = /\/check-in\/(evt-[a-zA-Z0-9]+)/;
const STATUSES = new Set(["invited", "approved", "declined"]);

function cleanStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

function cleanDate(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function parseEventRow(
  raw: Record<string, string | undefined>,
): ParseEventRowResult {
  const email = cleanStr(raw.email)?.toLowerCase() ?? null;
  if (!email) return { ok: false, reason: "missing email" };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: `invalid email: ${email}`, email };
  }

  const qr = cleanStr(raw.qr_code_url);
  if (!qr) {
    return { ok: false, reason: "missing qr_code_url", email };
  }
  const m = qr.match(EVENT_ID_RE);
  if (!m) {
    return {
      ok: false,
      reason: `qr_code_url did not contain evt-... id: ${qr}`,
      email,
    };
  }
  const luma_event_id = m[1];

  const statusRaw = cleanStr(raw.approval_status)?.toLowerCase() ?? null;
  if (!statusRaw || !STATUSES.has(statusRaw)) {
    return {
      ok: false,
      reason: `invalid approval_status: ${statusRaw ?? "(blank)"}`,
      email,
    };
  }
  const approval_status = statusRaw as EventAttendanceRow["approval_status"];

  let name = cleanStr(raw.name);
  if (!name) {
    const first = cleanStr(raw.first_name) ?? "";
    const last = cleanStr(raw.last_name) ?? "";
    const synth = `${first} ${last}`.trim();
    name = synth.length ? synth : null;
  }

  return {
    ok: true,
    row: {
      luma_event_id,
      guest_api_id: cleanStr(raw.api_id),
      name,
      email,
      registered_at: cleanDate(raw.created_at),
      checked_in_at: cleanDate(raw.checked_in_at),
      approval_status,
    },
  };
}

// Columns we actively ignore. Everything else (custom questions, unknown
// future Luma additions) also gets dropped but is exposed to the caller so
// it can log them in luma_imports.unmapped_headers.
export const KNOWN_EVENT_HEADERS = new Set<string>([
  "api_id",
  "name",
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "created_at",
  "approval_status",
  "checked_in_at",
  "utm_source",
  "qr_code_url",
  "amount",
  "amount_tax",
  "amount_discount",
  "currency",
  "coupon_code",
  "eth_address",
  "solana_address",
  "survey_response_rating",
  "survey_response_feedback",
  "ticket_type_id",
  "ticket_name",
]);

export function eventUnmappedHeaders(rawHeaders: string[]): string[] {
  const unmapped: string[] = [];
  for (const h of rawHeaders) {
    const n = h
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!KNOWN_EVENT_HEADERS.has(n)) unmapped.push(h);
  }
  return unmapped;
}
