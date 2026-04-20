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
    // Table doesn't exist yet (migration SQL hasn't been run). Fall back
    // to the hardcoded seed so the app keeps working. Supabase can return
    // this error in several shapes depending on PostgREST version:
    //   - Postgres code "42P01" (undefined_table)
    //   - PostgREST code "PGRST205" (schema cache miss)
    //   - Message variants: "does not exist", "Could not find the table",
    //     "schema cache"
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    const isMissingTable =
      code === "42P01" ||
      code === "PGRST205" ||
      msg.includes("does not exist") ||
      msg.includes("could not find the table") ||
      msg.includes("schema cache");

    if (isMissingTable) {
      console.warn(
        "[eboard-db] eboard_entries table not found — using EBOARD_SEED fallback.",
      );
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
