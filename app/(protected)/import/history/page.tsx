import "server-only";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { formatDate } from "@/lib/format";
import type { LumaImport } from "@/lib/types";

export default async function ImportHistoryPage() {
  const { data, error } = await supabaseServer
    .from("luma_imports")
    .select(
      "id, uploaded_at, uploaded_by, filename, row_count, new_count, updated_count, unchanged_count, blocked_count, error_count, status, dry_run",
    )
    .eq("dry_run", false)
    .order("uploaded_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load imports: ${error.message}`);
  const rows = (data ?? []) as Array<Pick<LumaImport,
    | "id"
    | "uploaded_at"
    | "uploaded_by"
    | "filename"
    | "row_count"
    | "new_count"
    | "updated_count"
    | "unchanged_count"
    | "blocked_count"
    | "error_count"
    | "status"
    | "dry_run"
  >>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Data pipeline
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Import history
          </h1>
        </div>
        <Link
          href="/import"
          className="shrink-0 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          ← Back to upload
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No imports yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="p-3 font-medium">Imported at</th>
                <th className="p-3 font-medium">By</th>
                <th className="p-3 font-medium">Filename</th>
                <th className="p-3 text-right font-medium">Rows</th>
                <th className="p-3 text-right font-medium">New</th>
                <th className="p-3 text-right font-medium">Updated</th>
                <th className="p-3 text-right font-medium">Unchanged</th>
                <th className="p-3 text-right font-medium">Blocked</th>
                <th className="p-3 text-right font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950"
                >
                  <td className="p-3">
                    <Link
                      href={`/import/history/${r.id}`}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      {formatDate(r.uploaded_at)}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.uploaded_by}</td>
                  <td className="p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {r.filename ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.row_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.new_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.updated_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.unchanged_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.blocked_count ?? "—"}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums">
                    {r.error_count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
