import { getLastImport, isStale, staleDays } from "@/lib/freshness";
import { CsvDropzone } from "@/components/csv-dropzone";
import { Chip } from "@/components/ui/chip";
import { formatDate } from "@/lib/format";

export default async function ImportPage() {
  const last = await getLastImport();
  const stale = isStale(last?.uploaded_at ?? null);
  const days = staleDays(last?.uploaded_at ?? null);

  return (
    <main className="mx-auto max-w-xl px-6 py-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-zinc-900">
        Import Luma CSV
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        Upload the latest Luma members export. Existing member data (major,
        tags, etc.) will not be overwritten.
      </p>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-zinc-900">Last import</h2>
        {last ? (
          <div className="space-y-2 text-sm">
            <p className="text-zinc-700">
              <span className="font-medium">
                {formatDate(last.uploaded_at)}
              </span>{" "}
              by{" "}
              <span className="font-mono text-zinc-900">
                {last.uploaded_by}
              </span>
              {days !== null && (
                <span className="ml-2 text-zinc-500">({days}d ago)</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="green">{last.new_count ?? 0} new</Chip>
              <Chip tone="indigo">{last.updated_count ?? 0} updated</Chip>
              <Chip tone="zinc">{last.blocked_count ?? 0} blocked</Chip>
              <Chip tone={last.error_count ? "amber" : "zinc"}>
                {last.error_count ?? 0} errors
              </Chip>
              {stale && <Chip tone="amber">Stale — re-upload recommended</Chip>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No imports yet. Upload the CSV below to seed the dashboard.
          </p>
        )}
      </div>

      <CsvDropzone />
    </main>
  );
}
