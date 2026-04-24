"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  importCsvBatch,
  type ImportBatchResult,
  type PerFileResult,
  type ImportError,
} from "@/app/(protected)/import/actions";
import { detectFormat, type CsvFormat } from "@/lib/csv-format";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

type Override = "auto" | "subscribed" | "event";

type FileEntry = {
  file: File;
  detected: CsvFormat;
  override: Override;
};

type ClientError = { message: string };
type State =
  | { kind: "idle" }
  | { kind: "file-error"; error: ClientError }
  | { kind: "server-result"; batch: ImportBatchResult };

async function sniffHeaders(file: File): Promise<string[]> {
  // Read the first ~4 KB of the file and let papaparse do a single-row
  // parse. Quote-aware, so headers like `"Last, First",email` are read
  // as two fields and not four. `preview: 1` limits it to the first row
  // even if our 4 KB slice happened to contain more.
  const slice = file.slice(0, 4096);
  const text = await slice.text();
  if (!text.trim()) return [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    preview: 1,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h,
  });
  return parsed.meta.fields ?? [];
}

export function CsvDropzone() {
  const router = useRouter();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  async function onFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const next: FileEntry[] = [];
    const badNames: string[] = [];
    for (const f of Array.from(incoming)) {
      if (!f.name.toLowerCase().endsWith(".csv")) {
        badNames.push(f.name);
        continue;
      }
      let detected: CsvFormat = "unknown";
      try {
        const headers = await sniffHeaders(f);
        detected = detectFormat(headers);
      } catch {
        detected = "unknown";
      }
      next.push({ file: f, detected, override: "auto" });
    }
    if (badNames.length > 0) {
      setState({
        kind: "file-error",
        error: {
          message: `Only .csv files are accepted (rejected: ${badNames.join(", ")})`,
        },
      });
    } else {
      setState({ kind: "idle" });
    }
    if (next.length > 0) {
      setFiles((prev) => [...prev, ...next]);
    }
  }

  function removeAt(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function setOverride(idx: number, value: Override) {
    setFiles((prev) =>
      prev.map((entry, i) =>
        i === idx ? { ...entry, override: value } : entry,
      ),
    );
  }

  function handleUpload() {
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach((entry, i) => {
      fd.append("file", entry.file);
      fd.append(`override_${i}`, entry.override);
    });
    setState({ kind: "idle" });
    startTransition(async () => {
      const batch = await importCsvBatch(fd, dryRun);
      setState({ kind: "server-result", batch });
      const anySaved = batch.files.some((f) => f.ok && !f.dry_run);
      if (anySaved) {
        setFiles([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        }`}
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Drop CSVs here, or{" "}
          <label className="cursor-pointer text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
            browse
            <input
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFiles(e.target.files);
                // Allow re-selecting the same file after a remove.
                e.target.value = "";
              }}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Max 10 MB each. Subscribed and per-event exports both accepted.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((entry, i) => (
            <FileRow
              key={`${entry.file.name}-${i}`}
              entry={entry}
              onOverrideChange={(v) => setOverride(i, v)}
              onRemove={() => removeAt(i)}
            />
          ))}

          <div className="flex items-center justify-end gap-3 pt-1">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Preview (don&rsquo;t save)
            </label>
            <Button onClick={handleUpload} disabled={isPending}>
              {isPending
                ? dryRun
                  ? "Previewing…"
                  : "Uploading…"
                : dryRun
                  ? `Preview ${files.length} file${files.length === 1 ? "" : "s"}`
                  : `Upload ${files.length} file${files.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}

      {state.kind === "file-error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {state.error.message}
          </p>
        </div>
      )}

      {state.kind === "server-result" && (
        <BatchResultPanel batch={state.batch} />
      )}
    </div>
  );
}

function detectedLabel(d: CsvFormat): string {
  if (d === "subscribed") return "subscribed";
  if (d === "event") return "event";
  return "unknown";
}

function FileRow({
  entry,
  onOverrideChange,
  onRemove,
}: {
  entry: FileEntry;
  onOverrideChange: (value: Override) => void;
  onRemove: () => void;
}) {
  const kb = (entry.file.size / 1024).toFixed(1);
  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">
          {entry.file.name}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {kb} KB ·{" "}
          <span className="uppercase tracking-wider">
            detected: {detectedLabel(entry.detected)}
          </span>
        </p>
      </div>
      <label className="sr-only" htmlFor={`override-${entry.file.name}`}>
        Override type
      </label>
      <select
        id={`override-${entry.file.name}`}
        value={entry.override}
        onChange={(e) => onOverrideChange(e.target.value as Override)}
        className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-violet-400"
      >
        <option value="auto">
          Auto{entry.detected !== "unknown" ? ` (${entry.detected})` : ""}
        </option>
        <option value="subscribed">Subscribed</option>
        <option value="event">Event</option>
      </select>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entry.file.name}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        &times;
      </button>
    </div>
  );
}

function BatchResultPanel({ batch }: { batch: ImportBatchResult }) {
  if (batch.files.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No CSVs selected.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {batch.files.map((result, i) => (
        <PerFileCard key={i} result={result} />
      ))}
    </div>
  );
}

function toneClass(tone: "red" | "amber" | "green"): string {
  if (tone === "red") {
    return "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30";
  }
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30";
  }
  return "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30";
}

function PerFileCard({ result }: { result: PerFileResult }) {
  if (!result.ok) {
    return (
      <div className={`rounded-lg border p-4 ${toneClass("red")}`}>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.filename}
        </p>
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          {result.message}
        </p>
      </div>
    );
  }

  const tone: "amber" | "green" = result.error_count > 0 ? "amber" : "green";
  const subtitleParts: string[] = [result.source_type];
  if (result.luma_event_name) subtitleParts.push(result.luma_event_name);
  if (result.replacing) subtitleParts.push("replacing previous import");

  return (
    <div className={`space-y-3 rounded-lg border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {result.filename}
          </p>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {subtitleParts.join(" · ")}
          </p>
          {result.dry_run && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Preview complete (nothing saved)
            </p>
          )}
        </div>
        <Link
          href={`/import/history/${result.import_id}`}
          className="shrink-0 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View details →
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {result.source_type === "subscribed" && (
          <>
            <Chip tone="green">{result.new_count} new</Chip>
            <Chip tone="violet">{result.updated_count} updated</Chip>
            <Chip tone="zinc">{result.unchanged_count} unchanged</Chip>
            <Chip tone="zinc">{result.blocked_count} blocked</Chip>
          </>
        )}
        {result.source_type === "event" && (
          <>
            <Chip tone="green">{result.new_count} new members</Chip>
            <Chip tone="violet">{result.updated_count} updated members</Chip>
            <Chip tone="zinc">{result.blocked_count} blocked</Chip>
            <Chip tone="zinc">
              {result.registered_count ?? 0} registered ·{" "}
              {result.checked_in_count ?? 0} checked in
            </Chip>
          </>
        )}
        <Chip tone={result.error_count ? "amber" : "zinc"}>
          {result.error_count} errors
        </Chip>
      </div>

      <HeaderMappingPanel
        mapping={result.header_mapping}
        unmapped={result.unmapped_headers}
      />

      {result.errors.length > 0 && <ErrorsTable errors={result.errors} />}
    </div>
  );
}

function HeaderMappingPanel({
  mapping,
  unmapped,
}: {
  mapping: Record<string, string>;
  unmapped: string[];
}) {
  const rows = Object.entries(mapping);
  if (rows.length === 0 && unmapped.length === 0) return null;
  return (
    <details className="rounded-md border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Header mapping ({rows.length} mapped
        {unmapped.length ? `, ${unmapped.length} ignored` : ""})
      </summary>
      <div className="mt-3 space-y-3">
        {rows.length > 0 && (
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
          <div>
            <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              These columns were ignored:
            </p>
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {unmapped.join(", ")}
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function ErrorsTable({ errors }: { errors: ImportError[] }) {
  return (
    <details
      open
      className="rounded-md border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Row errors ({errors.length})
      </summary>
      <table className="mt-3 w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Row</th>
            <th className="py-1 pr-3 text-left font-medium">Email</th>
            <th className="py-1 text-left font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="text-zinc-800 dark:text-zinc-200">
          {errors.map((e, i) => (
            <tr
              key={i}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-1 pr-3 font-mono tabular-nums">{e.row}</td>
              <td className="py-1 pr-3 font-mono">{e.email ?? "—"}</td>
              <td className="py-1">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
