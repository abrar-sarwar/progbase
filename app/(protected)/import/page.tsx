import Link from "next/link";
import { getLastImport, isStale, staleDays } from "@/lib/freshness";
import { CsvDropzone } from "@/components/csv-dropzone";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/format";

export default async function ImportPage() {
  const last = await getLastImport();
  const stale = isStale(last?.uploaded_at ?? null);
  const days = staleDays(last?.uploaded_at ?? null);

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Data pipeline
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Import Luma CSV
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Upload one or more Luma CSVs. Calendar-subscribed and per-event
            guest exports are both supported — drop them in together and
            we&rsquo;ll route each one.
          </p>
        </div>
        <Link
          href="/import/history"
          className="shrink-0 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View recent imports →
        </Link>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Last import
        </h2>
        {last ? (
          <div className="space-y-2 text-sm">
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">
                {formatDate(last.uploaded_at)}
              </span>{" "}
              by{" "}
              <span className="font-mono text-zinc-900 dark:text-zinc-50">
                {last.uploaded_by}
              </span>
              {days !== null && (
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                  ({days}d ago)
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="green">{last.new_count ?? 0} new</Chip>
              <Chip tone="violet">{last.updated_count ?? 0} updated</Chip>
              <Chip tone="zinc">{last.blocked_count ?? 0} blocked</Chip>
              <Chip tone={last.error_count ? "amber" : "zinc"}>
                {last.error_count ?? 0} errors
              </Chip>
              {stale && <Chip tone="amber">Stale — re-upload recommended</Chip>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No imports yet. Upload the CSV below to seed the dashboard.
          </p>
        )}
      </div>

      <CsvDropzone />
    </main>
  );
}
