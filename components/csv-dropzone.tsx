"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { importCsv, type ImportResult } from "@/app/(protected)/import/actions";
import { useRouter } from "next/navigation";

export function CsvDropzone() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  function onFiles(files: FileList | null) {
    const f = files?.[0] ?? null;
    if (f && !f.name.toLowerCase().endsWith(".csv")) {
      setResult({
        ok: false,
        newCount: 0,
        updatedCount: 0,
        blockedCount: 0,
        errorCount: 0,
        rowCount: 0,
        errors: [],
        message: "Only .csv files are accepted",
      });
      setFile(null);
      return;
    }
    setFile(f);
    setResult(null);
  }

  function handleUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setResult(null);
    startTransition(async () => {
      const res = await importCsv(fd);
      setResult(res);
      if (res.ok) {
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
        <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">
              {file.name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button onClick={handleUpload} disabled={isPending}>
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      )}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
              : "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
          }`}
        >
          {result.message && (
            <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {result.message}
            </p>
          )}
          {result.ok ? (
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="green">{result.newCount} new</Chip>
              <Chip tone="violet">{result.updatedCount} updated</Chip>
              <Chip tone="zinc">{result.blockedCount} blocked</Chip>
              <Chip tone={result.errorCount ? "amber" : "zinc"}>
                {result.errorCount} errors
              </Chip>
            </div>
          ) : null}
          {result.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">
                Error details ({result.errors.length})
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.rowIndex}: {e.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
