"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlacklistEntry } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { addBlacklist, removeBlacklist } from "@/app/blacklist/actions";

type SortKey = "email" | "name" | "added_by" | "added_at";
type SortDir = "asc" | "desc";

export function BlacklistTable({ entries }: { entries: BlacklistEntry[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("added_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? entries.filter(
          (e) =>
            e.email.toLowerCase().includes(q) ||
            (e.name ?? "").toLowerCase().includes(q) ||
            e.reason.toLowerCase().includes(q),
        )
      : entries;
    const sorted = [...base].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as Record<string, unknown>)[sortKey] ?? "";
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === "asc" ? -1 : 1;
      if (as > bs) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [entries, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleAdd() {
    setFormError(null);
    startTransition(async () => {
      try {
        await addBlacklist({
          email: newEmail,
          name: newName,
          reason: newReason,
        });
        setNewEmail("");
        setNewName("");
        setNewReason("");
        setAddOpen(false);
        router.refresh();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  function handleRemove(entry: BlacklistEntry) {
    const ok = window.confirm(`Remove ${entry.email} from the blacklist?`);
    if (!ok) return;
    const alsoUnhide = window.confirm(
      "Also un-hide this member in the members list (if they exist)?",
    );
    startTransition(async () => {
      await removeBlacklist(entry.email, alsoUnhide);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
            Moderation
          </span>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900">
              Blacklist
            </h1>
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56"
          />
          <Button variant="outline" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? "Close" : "Add entry"}
          </Button>
        </div>
      </div>

      {addOpen && (
        <div className="mb-4 grid gap-2 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_1fr_2fr_auto]">
          <Input
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Reason (required)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={isPending}>
            Add
          </Button>
          {formError && (
            <p className="col-span-full text-xs text-red-600">{formError}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <Th
                k="email"
                label="Email"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <Th
                k="name"
                label="Name"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <th className="h-9 border-b border-zinc-200 px-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Reason
              </th>
              <Th
                k="added_by"
                label="Added by"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <Th
                k="added_at"
                label="Added"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <th className="h-9 border-b border-zinc-200 px-3 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr
                key={e.email}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/60"
              >
                <td className="h-10 px-3 font-mono text-zinc-700">{e.email}</td>
                <td className="h-10 px-3 text-zinc-700">
                  {e.name ?? <span className="text-zinc-300">—</span>}
                </td>
                <td
                  className="h-10 max-w-[300px] truncate px-3 text-zinc-700"
                  title={e.reason}
                >
                  {e.reason}
                </td>
                <td className="h-10 px-3 font-mono text-xs text-zinc-600">
                  {e.added_by}
                </td>
                <td className="h-10 px-3 font-mono text-zinc-700 tabular-nums">
                  {formatDate(e.added_at)}
                </td>
                <td className="h-10 px-3 text-right">
                  <Button
                    variant="danger"
                    className="h-7 px-2 text-xs"
                    disabled={isPending}
                    onClick={() => handleRemove(e)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({
  k,
  label,
  sortKey,
  sortDir,
  onClick,
}: {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  return (
    <th
      className={cn(
        "h-9 cursor-pointer select-none border-b border-zinc-200 px-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-900",
      )}
      onClick={() => onClick(k)}
    >
      {label}
      {sortKey === k && (
        <span className="ml-1 text-zinc-400">
          {sortDir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </th>
  );
}
