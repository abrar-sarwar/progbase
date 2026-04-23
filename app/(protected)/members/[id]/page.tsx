import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember } from "@/lib/members";
import { MemberEditForm } from "@/components/member-edit-form";
import { formatDate } from "@/lib/format";
import { isEboard } from "@/lib/eboard";
import { listEboardEntries, toEntry } from "@/lib/eboard-db";
import { Chip } from "@/components/ui/chip";
import { listMemberEdits } from "@/lib/member-edits";
import { listMemberEventHistory } from "@/lib/events";
import type { MemberEdit } from "@/lib/types";

export default async function MemberEditPage({
  params,
}: {
  params: { id: string };
}) {
  const memberApiId = decodeURIComponent(params.id);
  const [member, eboardRows, edits, eventHistory] = await Promise.all([
    getMember(memberApiId),
    listEboardEntries(),
    listMemberEdits(memberApiId, 20),
    listMemberEventHistory(memberApiId),
  ]);
  if (!member) notFound();
  const eboardEntries = eboardRows.map(toEntry);

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Member · editable
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            {member.name ?? member.email ?? member.user_api_id}
          </h1>
          {isEboard(member, eboardEntries) && (
            <Chip tone="violet">E-board</Chip>
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {member.email ?? "—"}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MemberEditForm member={member} />
        <aside className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Luma data
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                First seen
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatDate(member.first_seen)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Events approved
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                {member.event_approved_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Events checked in
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
                {member.event_checked_in_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                User API ID
              </dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {member.user_api_id}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
      <ChangeHistory edits={edits} />
      <EventHistory eventHistory={eventHistory} />
    </main>
  );
}

function EventHistory({
  eventHistory,
}: {
  eventHistory: Awaited<ReturnType<typeof listMemberEventHistory>>;
}) {
  if (eventHistory.length === 0) return null;
  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Event history ({eventHistory.length})
      </h2>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">Date</th>
            <th className="py-1 pr-3 text-left font-medium">Event</th>
            <th className="py-1 pr-3 text-left font-medium">Status</th>
            <th className="py-1 text-left font-medium">Checked in</th>
          </tr>
        </thead>
        <tbody>
          {eventHistory.map((e) => (
            <tr
              key={e.luma_event_id}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-1 pr-3 font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                {formatDate(e.event_date)}
              </td>
              <td className="py-1 pr-3">
                <Link
                  href={`/events/${encodeURIComponent(e.luma_event_id)}`}
                  className="text-violet-600 hover:text-violet-700"
                >
                  {e.name}
                </Link>
              </td>
              <td className="py-1 pr-3">{e.approval_status}</td>
              <td className="py-1">
                {e.checked_in_at ? formatDate(e.checked_in_at) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ChangeHistory({ edits }: { edits: MemberEdit[] }) {
  if (edits.length === 0) {
    return (
      <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Change history
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No changes logged yet.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Change history
      </h2>
      <table className="w-full text-xs">
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="py-1 pr-3 text-left font-medium">When</th>
            <th className="py-1 pr-3 text-left font-medium">Source</th>
            <th className="py-1 pr-3 text-left font-medium">Who</th>
            <th className="py-1 pr-3 text-left font-medium">Field</th>
            <th className="py-1 pr-3 text-left font-medium">Old</th>
            <th className="py-1 text-left font-medium">New</th>
          </tr>
        </thead>
        <tbody>
          {edits.map((e) => (
            <tr
              key={e.id}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="py-1 pr-3 font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                {new Date(e.changed_at).toLocaleString()}
              </td>
              <td className="py-1 pr-3">
                <span
                  className={
                    e.source === "import"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-zinc-700 dark:text-zinc-300"
                  }
                >
                  {e.source}
                </span>
              </td>
              <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                {e.changed_by ?? e.editor_email}
              </td>
              <td className="py-1 pr-3 font-mono">{e.field}</td>
              <td className="py-1 pr-3 font-mono text-zinc-600 dark:text-zinc-400">
                {e.old_value ?? "—"}
              </td>
              <td className="py-1 font-mono text-zinc-900 dark:text-zinc-100">
                {e.new_value ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
