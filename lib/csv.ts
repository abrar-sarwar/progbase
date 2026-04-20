import Papa from "papaparse";

export type LumaRow = {
  user_api_id: string;
  name: string | null;
  email: string | null;
  first_seen: string | null;
  event_approved_count: number;
  event_checked_in_count: number;
};

export type ParseError = { rowIndex: number; reason: string };

export type ParseResult =
  | { ok: true; rows: LumaRow[]; errors: ParseError[] }
  | { ok: false; missing: string[] };

const REQUIRED_COLUMNS = ["user_api_id", "name", "email"] as const;

function toInt(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function toDateIso(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function parseLumaCsv(buffer: Buffer): ParseResult {
  let text = buffer.toString("utf-8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length > 0) {
    return { ok: false, missing: [...missing] };
  }

  const byId = new Map<string, LumaRow>();
  const errors: ParseError[] = [];

  parsed.data.forEach((row, idx) => {
    const userApiId = (row.user_api_id ?? "").trim();
    if (!userApiId) {
      errors.push({
        rowIndex: idx + 2,
        reason: "Missing user_api_id",
      });
      return;
    }
    const rec: LumaRow = {
      user_api_id: userApiId,
      name: strOrNull(row.name),
      email: strOrNull(row.email),
      first_seen: toDateIso(row.first_seen),
      event_approved_count: toInt(row.event_approved_count),
      event_checked_in_count: toInt(row.event_checked_in_count),
    };
    byId.set(userApiId, rec);
  });

  return { ok: true, rows: Array.from(byId.values()), errors };
}
