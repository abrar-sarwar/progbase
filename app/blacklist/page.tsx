import { supabaseServer } from "@/lib/supabase-server";
import type { BlacklistEntry } from "@/lib/types";
import { BlacklistTable } from "@/components/blacklist-table";

export default async function BlacklistPage() {
  const { data, error } = await supabaseServer
    .from("blacklist")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) {
    console.error("[BlacklistPage] select failed:", error);
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-6">
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
            Moderation
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900">
            Blacklist
          </h1>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-medium">Could not load blacklist.</p>
          <p className="mt-1 text-xs font-mono">{error.message}</p>
          <p className="mt-3 text-xs text-red-600">
            Check the Supabase dashboard and confirm the <code>blacklist</code>{" "}
            table exists with the schema from README.md.
          </p>
        </div>
      </main>
    );
  }

  const entries = (data as BlacklistEntry[]) ?? [];

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <BlacklistTable entries={entries} />
    </main>
  );
}
