import "server-only";
import { supabaseServer } from "./supabase-server";
import type { LumaImport } from "./types";

export { STALE_THRESHOLD_DAYS, staleDays, isStale } from "./freshness-utils";

export async function getLastImport(): Promise<LumaImport | null> {
  const { data, error } = await supabaseServer
    .from("luma_imports")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as LumaImport) ?? null;
}
