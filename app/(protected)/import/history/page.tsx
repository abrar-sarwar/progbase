import "server-only";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
import { formatDate } from "@/lib/format";
import type { LumaImport } from "@/lib/types";

type Row = Pick<
  LumaImport,
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
  | "source_type"
  | "luma_event_id"
  | "luma_event_name"
  | "batch_id"
>;

type Group = {
  key: string;
  rows: Row[];
  uploaded_at: string;
  uploaded_by: string;
};

function groupByBatch(rows: Row[]): Group[] {
  const groups = new Map<string, Row[]>();
  const solos: Row[] = [];
  for (const r of rows) {
    if (r.batch_id) {
      const list = groups.get(r.batch_id) ?? [];
      list.push(r);
      groups.set(r.batch_id, list);
    } else {
      solos.push(r);
    }
  }
  const out: Group[] = [];
  for (const [id, rs] of groups) {
    rs.sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
    out.push({
      key: id,
      rows: rs,
      uploaded_at: rs[0].uploaded_at,
      uploaded_by: rs[0].uploaded_by,
    });
  }
  for (const r of solos) {
    out.push({
      key: r.id,
      rows: [r],
      uploaded_at: r.uploaded_at,
      uploaded_by: r.uploaded_by,
    });
  }
  return out.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

function groupSummary(rows: Row[]): string {
  const newTotal = rows.reduce((acc, r) => acc + (r.new_count ?? 0), 0);
  const updTotal = rows.reduce((acc, r) => acc + (r.updated_count ?? 0), 0);
  const errTotal = rows.reduce((acc, r) => acc + (r.error_count ?? 0), 0);
  return `${newTotal} new · ${updTotal} updated · ${errTotal} errors`;
}

export default async function ImportHistoryPage() {
  const { data, error } = await supabaseServer
    .from("luma_imports")
    .select(
      "id, uploaded_at, uploaded_by, filename, row_count, new_count, updated_count, unchanged_count, blocked_count, error_count, status, dry_run, source_type, luma_event_id, luma_event_name, batch_id",
    )
    .eq("dry_run", false)
    .order("uploaded_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load imports: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const groups = groupByBatch(rows);

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

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No imports yet.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div
              key={g.key}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDate(g.uploaded_at)}
                  </span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {g.uploaded_by}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {g.rows.length === 1
                      ? "1 file"
                      : `${g.rows.length} files`}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  {groupSummary(g.rows)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <th className="p-3 font-medium">Imported at</th>
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
                    {g.rows.map((r) => (
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
                        <td className="p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          <div>{r.filename ?? "—"}</div>
                          {r.source_type === "event" && r.luma_event_name && (
                            <div className="mt-0.5 italic text-zinc-500 dark:text-zinc-400">
                              {r.luma_event_name}
                            </div>
                          )}
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
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
