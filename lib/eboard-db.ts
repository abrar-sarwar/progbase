import "server-only";
import { supabaseServer } from "./supabase-server";
import type { EboardEntry } from "./eboard";
import { EBOARD_SEED } from "./eboard";

export type EboardRow = {
  id: string;
  label: string;
  email: string | null;
  name: string | null;
  added_by: string;
  added_at: string;
};

/**
 * Fetch the full e-board list.
 *
 * Prefers the `eboard_entries` Supabase table. If the table doesn't exist
 * yet (e.g., the migration SQL hasn't been run), falls back to the
 * hardcoded seed in lib/eboard.ts so the app stays usable.
 */
export async function listEboardEntries(): Promise<EboardRow[]> {
  const { data, error } = await supabaseServer
    .from("eboard_entries")
    .select("*")
    .order("added_at", { ascending: true });

  if (error) {
    // 42P01 = relation does not exist; fall back to seed.
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return EBOARD_SEED.map((e, i) => ({
        id: `seed-${i}`,
        label: e.label,
        email: e.email ?? null,
        name: e.name ?? null,
        added_by: "seed",
        added_at: "1970-01-01T00:00:00Z",
      }));
    }
    throw new Error(`Failed to list e-board entries: ${error.message}`);
  }

  return (data ?? []) as EboardRow[];
}

/** Cast a DB row to the pure EboardEntry shape used by the matching helpers. */
export function toEntry(row: EboardRow): EboardEntry {
  return {
    label: row.label,
    email: row.email ?? undefined,
    name: row.name ?? undefined,
  };
}
