"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Member } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { blockMember } from "@/app/_actions/members";

type SortKey =
  | "name"
  | "email"
  | "major"
  | "grad_year"
  | "gender"
  | "first_seen"
  | "event_approved_count"
  | "event_checked_in_count";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "major", label: "Major" },
  { key: "grad_year", label: "Grad Year" },
  { key: "gender", label: "Gender" },
  { key: "first_seen", label: "First Seen" },
  { key: "event_approved_count", label: "Approved", align: "right" },
  { key: "event_checked_in_count", label: "Checked In", align: "right" },
];

export function MembersTable({
  members,
  title = "Members",
  eyebrow = "Roster",
  unitSingular = "person",
  unitPlural = "people",
}: {
  members: Member[];
  title?: string;
  eyebrow?: string;
  unitSingular?: string;
  unitPlural?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("event_checked_in_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? members.filter(
          (m) =>
            (m.name ?? "").toLowerCase().includes(q) ||
            (m.email ?? "").toLowerCase().includes(q),
        )
      : members;
    const sorted = [...base].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === "asc" ? -1 : 1;
      if (as > bs) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [members, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "event_approved_count" || key === "event_checked_in_count"
          ? "desc"
          : "asc",
      );
    }
  }

  function handleBlock(member: Member) {
    const reason = window.prompt(
      `Block ${member.name ?? member.email ?? member.user_api_id}?\nReason (required):`,
    );
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      await blockMember(member.user_api_id, reason.trim());
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </span>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
            <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {filtered.length.toLocaleString()}{" "}
              {filtered.length === 1 ? unitSingular : unitPlural}
            </span>
          </div>
        </div>
        <Input
          placeholder="Search name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-[0_1px_0_rgba(9,9,11,0.04)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/80">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "h-10 cursor-pointer select-none border-b border-zinc-200 px-3 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-50",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                  onClick={() => toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <span
                      aria-hidden
                      className={cn(
                        "w-2 text-zinc-400 transition-opacity dark:text-zinc-500",
                        sortKey === c.key ? "opacity-100" : "opacity-0",
                      )}
                    >
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="h-10 border-b border-zinc-200 px-3 text-right text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.user_api_id}
                className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
              >
                <td className="h-10 px-3 text-zinc-900 dark:text-zinc-50">
                  {m.name ?? (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="h-10 px-3 text-zinc-600 dark:text-zinc-300">
                  {m.email ?? (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="h-10 px-3 text-zinc-600 dark:text-zinc-300">
                  {m.major ?? (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="h-10 px-3 text-zinc-600 dark:text-zinc-300">
                  {m.grad_year ?? (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="h-10 px-3 text-zinc-600 dark:text-zinc-300">
                  {m.gender ?? (
                    <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  )}
                </td>
                <td className="h-10 px-3 font-mono text-zinc-600 tabular-nums dark:text-zinc-300">
                  {formatDate(m.first_seen)}
                </td>
                <td
                  className={cn(
                    "h-10 px-3 text-right font-mono tabular-nums",
                    m.event_approved_count === 0
                      ? "text-zinc-300 dark:text-zinc-600"
                      : "text-zinc-900 dark:text-zinc-50",
                  )}
                >
                  {m.event_approved_count}
                </td>
                <td
                  className={cn(
                    "h-10 px-3 text-right font-mono tabular-nums",
                    m.event_checked_in_count === 0
                      ? "text-zinc-300 dark:text-zinc-600"
                      : "text-zinc-900 dark:text-zinc-50",
                  )}
                >
                  {m.event_checked_in_count}
                </td>
                <td className="h-10 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/members/${encodeURIComponent(m.user_api_id)}`}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      Edit
                    </Link>
                    <Button
                      variant="danger"
                      className="h-7 px-2 text-xs"
                      disabled={isPending}
                      onClick={() => handleBlock(m)}
                    >
                      Block
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
