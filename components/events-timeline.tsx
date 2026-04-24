import Link from "next/link";
import type { Event } from "@/lib/types";
import { formatDate } from "@/lib/format";

function showRate(e: Event): string {
  if (!e.approved_count) return "—";
  return `${Math.round((e.checked_in_count / e.approved_count) * 100)}%`;
}

function invitedCount(e: Event): number {
  // events.registered_count = invited + approved. Expose invited
  // separately so the timeline card doesn't double-count approvals
  // against a "Registered" column.
  return Math.max(0, e.registered_count - e.approved_count);
}

export function EventsTimeline({ events }: { events: Event[] }) {
  return (
    <ol className="relative ml-3 border-l border-violet-500/30 dark:border-violet-400/30">
      {events.map((e, i) => (
        <li
          key={e.luma_event_id}
          className="relative mb-6 pl-8"
          style={{ ["--i" as string]: i } as React.CSSProperties}
        >
          <span
            aria-hidden
            className="absolute -left-[5px] top-4 h-[10px] w-[10px] rounded-full bg-violet-500 ring-4 ring-white dark:ring-zinc-950"
          />
          <Link
            href={`/events/${encodeURIComponent(e.luma_event_id)}`}
            className="group block rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-600"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {formatDate(e.event_date)}
                </p>
                <h3 className="mt-1 font-display text-[20px] leading-tight text-zinc-900 group-hover:text-violet-700 dark:text-zinc-50 dark:group-hover:text-violet-300">
                  {e.name}
                </h3>
              </div>
              <dl className="flex gap-5 text-right font-mono tabular-nums">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Invited
                  </dt>
                  <dd className="text-sm text-zinc-900 dark:text-zinc-50">
                    {invitedCount(e)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Approved
                  </dt>
                  <dd className="text-sm text-zinc-900 dark:text-zinc-50">
                    {e.approved_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Checked in
                  </dt>
                  <dd className="text-sm text-zinc-900 dark:text-zinc-50">
                    {e.checked_in_count}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Show
                  </dt>
                  <dd className="text-sm text-violet-700 dark:text-violet-300">
                    {showRate(e)}
                  </dd>
                </div>
              </dl>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
