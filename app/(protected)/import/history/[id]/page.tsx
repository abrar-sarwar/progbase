import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { listImportEdits } from "@/lib/member-edits";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/format";
import type { LumaImport, ImportErrorRow } from "@/lib/types";

export default async function ImportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);

  const { data, error } = await supabaseServer
    .from("luma_imports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load import: ${error.message}`);
  if (!data) notFound();
  const imp = data as LumaImport;

  const edits = await listImportEdits(id);
  const editedIds = Array.from(
    new Set(edits.map((e) => e.member_user_api_id)),
  );
  const memberById = new Map<string, { name: string | null; email: string | null }>();
  if (editedIds.length > 0) {
    const { data: mem, error: merr } = await supabaseServer
      .from("members")
      .select("user_api_id, name, email")
      .in("user_api_id", editedIds);
    if (merr) throw new Error(`Failed to load members: ${merr.message}`);
    for (const m of mem ?? []) {
      memberById.set((m as { user_api_id: string }).user_api_id, {
        name: (m as { name: string | null }).name,
        email: (m as { email: string | null }).email,
      });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/import/history"
          className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          ← All imports
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-normal leading-tight tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          Import on {formatDate(imp.uploaded_at)}
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          by {imp.uploaded_by} · {imp.filename ?? "(no filename)"}
          {imp.dry_run && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              · dry-run (nothing saved)
            </span>
          )}
        </p>
        {imp.source_type === "event" && imp.luma_event_id && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Event:{" "}
            <Link
              href={`/events/${encodeURIComponent(imp.luma_event_id)}`}
              className="text-violet-600 hover:text-violet-700"
            >
              {imp.luma_event_name ?? imp.luma_event_id}
            </Link>
          </p>
        )}
      </div>

      <section className="mb-6 flex flex-wrap gap-1.5">
        <Chip tone="green">{imp.new_count ?? 0} new</Chip>
        <Chip tone="violet">{imp.updated_count ?? 0} updated</Chip>
        <Chip tone="zinc">{imp.unchanged_count ?? 0} unchanged</Chip>
        <Chip tone="zinc">{imp.blocked_count ?? 0} blocked</Chip>
        <Chip tone={imp.error_count ? "amber" : "zinc"}>
          {imp.error_count ?? 0} errors
        </Chip>
        <Chip tone="zinc">{imp.row_count ?? 0} rows total</Chip>
      </section>

      <MappingSection
        mapping={imp.header_mapping ?? {}}
        unmapped={imp.unmapped_headers ?? []}
      />

      {imp.errors && imp.errors.length > 0 && (
        <ErrorsSection errors={imp.errors} />
      )}

      <EditsSection edits={edits} members={memberById} />
    </main>
  );
}

function MappingSection({
  mapping,
  unmapped,
}: {
  mapping: Record<string, string>;
  unmapped: string[];
}) {
  const rows = Object.entries(mapping);
  return (
    <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Header mapping
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No mapping recorded for this import.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 pr-3 text-left font-medium">CSV header</th>
              <th className="py-1 text-left font-medium">Canonical field</th>
            </tr>
          </thead>
          <tbody className="font-mono text-zinc-800 dark:text-zinc-200">
            {rows.map(([csv, canonical]) => (
              <tr key={csv}>
                <td className="py-0.5 pr-3">{csv}</td>
                <td className="py-0.5">{canonical}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {unmapped.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
            Ignored columns ({unmapped.length}):
          </p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {unmapped.join(", ")}
          </p>
        </div>
      )}
    </section>
  );
}

function ErrorsSection({ errors }: { errors: ImportErrorRow[] }) {
  return (
    <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Errors ({errors.length})
      </h2>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Row</th>
            <th className="py-1 pr-3 text-left font-medium">Email</th>
            <th className="py-1 text-left font-medium">Reason</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr
              key={i}
              className="border-t border-amber-100 dark:border-amber-900/40"
            >
              <td className="py-1 pr-3 font-mono tabular-nums">{e.row}</td>
              <td className="py-1 pr-3 font-mono">{e.email ?? "—"}</td>
              <td className="py-1">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EditsSection({
  edits,
  members,
}: {
  edits: Awaited<ReturnType<typeof listImportEdits>>;
  members: Map<string, { name: string | null; email: string | null }>;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Member changes ({edits.length})
      </h2>
      {edits.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No member changes were written by this import.
        </p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="py-1 pr-3 text-left font-medium">Member</th>
              <th className="py-1 pr-3 text-left font-medium">Field</th>
              <th className="py-1 pr-3 text-left font-medium">Old</th>
              <th className="py-1 text-left font-medium">New</th>
            </tr>
          </thead>
          <tbody>
            {edits.map((e) => {
              const m = members.get(e.member_user_api_id);
              return (
                <tr
                  key={e.id}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-1 pr-3">
                    <Link
                      href={`/members/${encodeURIComponent(e.member_user_api_id)}`}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      {m?.name ?? m?.email ?? e.member_user_api_id}
                    </Link>
                  </td>
                  <td className="py-1 pr-3 font-mono">{e.field}</td>
                  <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                    {e.old_value ?? "—"}
                  </td>
                  <td className="py-1 font-mono text-zinc-900 dark:text-zinc-100">
                    {e.new_value ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
