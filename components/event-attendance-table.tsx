"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EventAttendanceWithMember } from "@/lib/types";
import { Chip } from "@/components/ui/chip";

type Filter = "all" | "approved" | "checked_in" | "no_show";

export function EventAttendanceTable({
  rows,
}: {
  rows: EventAttendanceWithMember[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "approved" && r.approval_status !== "approved")
        return false;
      if (filter === "checked_in" && !r.checked_in_at) return false;
      if (filter === "no_show") {
        if (r.approval_status !== "approved" || r.checked_in_at) return false;
      }
      if (!q) return true;
      const hay = `${r.member.name ?? ""} ${r.member.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, query]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Attendees ({filtered.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="checked_in">Checked in</option>
            <option value="no_show">No-shows</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Grad year</th>
              <th className="p-3 font-medium">Major</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Checked in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.member_user_api_id}
                className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950"
              >
                <td className="p-3">
                  <Link
                    href={`/members/${encodeURIComponent(r.member_user_api_id)}`}
                    className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    {r.member.name ?? "—"}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">
                  {r.member.email ?? "—"}
                </td>
                <td className="p-3">{r.member.grad_year ?? "—"}</td>
                <td className="p-3">{r.member.major ?? "—"}</td>
                <td className="p-3">
                  <Chip
                    tone={
                      r.approval_status === "approved"
                        ? "green"
                        : r.approval_status === "declined"
                          ? "red"
                          : "zinc"
                    }
                  >
                    {r.approval_status}
                  </Chip>
                </td>
                <td className="p-3">{r.checked_in_at ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
