"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  importCsv,
  type ImportResult,
  type ImportError,
} from "@/app/(protected)/import/actions";
import { useRouter } from "next/navigation";

type ClientError = { message: string };
type State =
  | { kind: "idle" }
  | { kind: "file-error"; error: ClientError }
  | { kind: "server-result"; result: ImportResult };

export function CsvDropzone() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  function onFiles(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f && !f.name.toLowerCase().endsWith(".csv")) {
      setState({
        kind: "file-error",
        error: { message: "Only .csv files are accepted" },
      });
      setFile(null);
      return;
    }
    setFile(f);
    setState({ kind: "idle" });
  }

  function handleUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setState({ kind: "idle" });
    startTransition(async () => {
      const res = await importCsv(fd, dryRun);
      setState({ kind: "server-result", result: res });
      if (res.ok && !res.dry_run) {
        setFile(null);
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
          onFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40"
            : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        }`}
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Drop CSV here, or{" "}
          <label className="cursor-pointer text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
            browse
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Max 10 MB. Required columns: user_api_id, name, email.
        </p>
      </div>

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">
              {file.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
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
                ? "Preview"
                : "Upload"}
          </Button>
        </div>
      )}

      {state.kind === "file-error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {state.error.message}
          </p>
        </div>
      )}

      {state.kind === "server-result" && <ResultPanel result={state.result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.message}
        </p>
      </div>
    );
  }

  const tone = result.error_count > 0 ? "amber" : "green";
  const bucketClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
      : "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30";

  return (
    <div className={`space-y-3 rounded-lg border p-4 ${bucketClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {result.dry_run ? "Preview complete (nothing saved)" : "Import complete"}
        </p>
        <Link
          href={`/import/history/${result.import_id}`}
          className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          View details →
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip tone="green">{result.new_count} new</Chip>
        <Chip tone="violet">{result.updated_count} updated</Chip>
        <Chip tone="zinc">{result.unchanged_count} unchanged</Chip>
        <Chip tone="zinc">{result.blocked_count} blocked</Chip>
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
    <details open className="rounded-md border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
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
            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
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
