import { supabaseServer } from "@/lib/supabase-server";
import type { BlacklistEntry } from "@/lib/types";
import { BlacklistTable } from "@/components/blacklist-table";

export default async function BlacklistPage() {
  const { data, error } = await supabaseServer
    .from("blacklist")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw new Error(error.message);
  const entries = (data as BlacklistEntry[]) ?? [];

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-6">
      <BlacklistTable entries={entries} />
    </main>
  );
}
