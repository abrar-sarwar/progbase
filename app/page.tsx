import { listVisibleMembers } from "@/lib/members";
import { MembersTable } from "@/components/members-table";
import { isEboard } from "@/lib/eboard";
import Image from "next/image";
import Link from "next/link";
import logo from "../public/progbase.png";

export default async function MembersPage() {
  const all = await listVisibleMembers();
  const members = all.filter((m) => !isEboard(m));
  const empty = all.length === 0;

  if (empty) {
    return (
      <main className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1400px] flex-col items-start overflow-hidden px-6 py-14">
        <div className="grain pointer-events-none absolute inset-0" />
        <div className="relative flex items-baseline gap-3 animate-fade-up">
          <Image
            src={logo}
            alt=""
            width={28}
            height={28}
            priority
            className="h-7 w-7 opacity-90"
          />
          <span className="text-[11px] uppercase tracking-[0.22em] text-violet-600 dark:text-violet-400">
            step one
          </span>
        </div>
        <h1 className="relative mt-3 max-w-2xl font-display text-[44px] font-normal leading-[1.05] tracking-tight-2 text-zinc-900 animate-fade-up dark:text-zinc-50">
          No members yet.
          <span className="block italic text-zinc-400 dark:text-zinc-500">
            Let&apos;s seed the roster.
          </span>
        </h1>
        <p className="relative mt-5 max-w-md text-sm leading-relaxed text-zinc-600 animate-fade-up dark:text-zinc-300">
          Download the latest Luma export for progsu and upload it below. Only
          the Luma columns we care about are stored — everything e-board-filled
          (majors, tags, notes) stays safely untouched on every re-import.
        </p>
        <div className="relative mt-8 flex items-center gap-3 animate-fade-up">
          <Link
            href="/import"
            className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Upload Luma CSV
            <span aria-hidden className="ml-2 opacity-60">
              →
            </span>
          </Link>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
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
