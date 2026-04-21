import type { CanonicalField } from "./csv-headers";
import { parseTags } from "./tags";

export type ParsedRow = {
  user_api_id: string;
  name: string;
  email: string | null;
  first_seen: string | null;
  tags: string[] | null;
  event_approved_count: number;
  event_checked_in_count: number;
};

export type ParseRowResult =
  | { ok: true; row: ParsedRow }
  | { ok: false; reason: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length ? s : null;
}

function cleanInt(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim().replace(/,/g, "");
  if (!s) return 0;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function cleanDate(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function parseRow(
  rawRow: Record<string, string | undefined>,
  mapping: Record<string, CanonicalField>,
): ParseRowResult {
  const byCanonical: Partial<Record<CanonicalField, string | undefined>> = {};
  for (const [csvHeader, canonical] of Object.entries(mapping)) {
    byCanonical[canonical] = rawRow[csvHeader];
  }

  const user_api_id = cleanStr(byCanonical.user_api_id) ?? "";
  if (!user_api_id) {
    return { ok: false, reason: "missing user_api_id" };
  }

  const rawEmail = cleanStr(byCanonical.email);
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, reason: `invalid email: ${email}`, email };
  }

  let name = cleanStr(byCanonical.name);
  if (!name) {
    const first = cleanStr(byCanonical.first_name);
    const last = cleanStr(byCanonical.last_name);
    const synth = [first ?? "", last ?? ""].join(" ").trim();
    name = synth.length ? synth : null;
  }
  if (!name) {
    return { ok: false, reason: "missing name", email: email ?? undefined };
  }

  const tagsList = parseTags(cleanStr(byCanonical.tags) ?? "");

  return {
    ok: true,
    row: {
      user_api_id,
      name,
      email,
      first_seen: cleanDate(byCanonical.first_seen),
      tags: tagsList.length ? tagsList : null,
      event_approved_count: cleanInt(byCanonical.event_approved_count),
      event_checked_in_count: cleanInt(byCanonical.event_checked_in_count),
    },
  };
}
