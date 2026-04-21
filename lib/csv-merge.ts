import type { ParsedRow } from "./csv-row";

export type LumaWriteSet = {
  user_api_id: string;
  name: string;
  email: string | null;
  first_seen: string | null;
  tags: string | null;
  event_approved_count: number;
  event_checked_in_count: number;
};

export type ExistingLuma = Partial<LumaWriteSet> & { user_api_id?: string };

export type FieldDiff = {
  field: Exclude<keyof LumaWriteSet, "user_api_id">;
  old: string | number | null;
  new: string | number | null;
};

function maxNum(a: number | null | undefined, b: number | null | undefined): number {
  return Math.max(a ?? 0, b ?? 0);
}

function minDate(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a ?? null;
  return a < b ? a : b;
}

function preferIncoming<T>(
  incoming: T | null,
  existing: T | null | undefined,
): T | null {
  return incoming !== null ? incoming : (existing ?? null);
}

const DIFFABLE_FIELDS: readonly FieldDiff["field"][] = [
  "name",
  "email",
  "first_seen",
  "tags",
  "event_approved_count",
  "event_checked_in_count",
];

export function mergeLumaFields(
  incoming: ParsedRow,
  existing: ExistingLuma | null,
): { merged: LumaWriteSet; diffs: FieldDiff[] } {
  const e = existing ?? {};
  const merged: LumaWriteSet = {
    user_api_id: incoming.user_api_id,
    name: preferIncoming(incoming.name, e.name) ?? incoming.name,
    email: preferIncoming(incoming.email, e.email),
    first_seen: minDate(incoming.first_seen, e.first_seen),
    tags: preferIncoming(incoming.tags, e.tags),
    event_approved_count: maxNum(
      incoming.event_approved_count,
      e.event_approved_count,
    ),
    event_checked_in_count: maxNum(
      incoming.event_checked_in_count,
      e.event_checked_in_count,
    ),
  };

  const COUNT_FIELDS = new Set<string>([
    "event_approved_count",
    "event_checked_in_count",
  ]);

  const diffs: FieldDiff[] = [];
  for (const f of DIFFABLE_FIELDS) {
    const oldVal = (e as Record<string, unknown>)[f];
    let oldNorm: string | number | null;
    if (oldVal === undefined) {
      // Treat missing numeric fields as 0, missing string fields as null
      oldNorm = COUNT_FIELDS.has(f) ? 0 : null;
    } else {
      oldNorm = oldVal as string | number | null;
    }
    const newNorm = merged[f] as string | number | null;
    if (oldNorm !== newNorm) {
      diffs.push({ field: f, old: oldNorm, new: newNorm });
    }
  }

  return { merged, diffs };
}
