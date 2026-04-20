import { listVisibleMembers } from "@/lib/members";
import { MembersTable } from "@/components/members-table";
import Link from "next/link";

export default async function MembersPage() {
  const members = await listVisibleMembers();
  const empty = members.length === 0;

  if (empty) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1400px] flex-col items-start px-6 py-14">
        <span className="text-[11px] uppercase tracking-[0.22em] text-indigo-600">
          step one
        </span>
        <h1 className="mt-3 max-w-2xl font-display text-[44px] font-normal leading-[1.05] tracking-tight-2 text-zinc-900">
          No members yet.
          <span className="block italic text-zinc-400">
            Let&apos;s seed the roster.
          </span>
        </h1>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-600">
          Download the latest Luma export for progsu and upload it below. Only
          the Luma columns we care about are stored — everything e-board-filled
          (majors, tags, notes) stays safely untouched on every re-import.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/import"
            className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Upload Luma CSV
            <span aria-hidden className="ml-2 text-zinc-500">
              →
            </span>
          </Link>
          <span className="text-xs text-zinc-400">
            Accepts .csv up to 10 MB
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <MembersTable members={members} />
    </main>
  );
}
