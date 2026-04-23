import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, listEventAttendance } from "@/lib/events";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
import { ApprovalPie } from "@/components/charts/approval-pie";
import { RegistrationVsCheckin } from "@/components/charts/registration-vs-checkin";
import { EventAttendanceTable } from "@/components/event-attendance-table";
import { EventDateEditor } from "@/components/event-date-editor";

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = decodeURIComponent(params.id);
  const event = await getEvent(id);
  if (!event) notFound();
  const attendance = await listEventAttendance(id);

  const invited = attendance.filter(
    (a) => a.approval_status === "invited",
  ).length;
  const approved = attendance.filter(
    (a) => a.approval_status === "approved",
  ).length;
  const declined = attendance.filter(
    (a) => a.approval_status === "declined",
  ).length;
  const registered = invited + approved;
  const checkedIn = attendance.filter((a) => a.checked_in_at).length;

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <Link
          href="/events"
          className="text-xs text-violet-600 hover:text-violet-700"
        >
          ← All events
        </Link>
        <h1 className="mt-2 font-display text-[32px] font-normal leading-tight tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          {event.name}
        </h1>
        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatDate(event.event_date)}</span>
          <EventDateEditor lumaEventId={id} initial={event.event_date} />
          <span className="font-mono">{id}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered" value={registered} />
        <Stat label="Approved" value={approved} />
        <Stat label="Checked in" value={checkedIn} />
        <Stat
          label="Show rate"
          value={
            approved === 0 ? "—" : `${Math.round((checkedIn / approved) * 100)}%`
          }
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Section title="Approval breakdown">
          <ApprovalPie data={{ invited, approved, declined }} />
        </Section>
        <Section title="Registered vs checked-in">
          <RegistrationVsCheckin data={{ registered, checked_in: checkedIn }} />
        </Section>
      </div>

      <EventAttendanceTable rows={attendance} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
