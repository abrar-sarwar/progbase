import Link from "next/link";
import { listEventsTimeline } from "@/lib/events";
import { EventsTimeline } from "@/components/events-timeline";

export default async function EventsPage() {
  const events = await listEventsTimeline();
  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Programming
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            Events
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Every Luma event we have guest data for. Newest at the top. Import
            an event&rsquo;s guest CSV on the{" "}
            <Link
              href="/import"
              className="underline decoration-violet-500/40 underline-offset-4 hover:decoration-violet-500"
            >
              Import page
            </Link>
            .
          </p>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No events yet. Drop a per-event guest CSV into{" "}
          <Link
            href="/import"
            className="text-violet-600 hover:text-violet-700"
          >
            /import
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <EventsTimeline events={events} />
      )}
    </main>
  );
}
