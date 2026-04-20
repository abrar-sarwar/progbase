import { notFound } from "next/navigation";
import { getMember } from "@/lib/members";
import { MemberEditForm } from "@/components/member-edit-form";
import { formatDate } from "@/lib/format";
import { isEboard } from "@/lib/eboard";
import { Chip } from "@/components/ui/chip";

export default async function MemberEditPage({
  params,
}: {
  params: { id: string };
}) {
  const member = await getMember(decodeURIComponent(params.id));
  if (!member) notFound();

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <div className="mb-6">
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
          Member · editable
        </span>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900">
            {member.name ?? member.email ?? member.user_api_id}
          </h1>
          {isEboard(member) && <Chip tone="indigo">E-board</Chip>}
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          {member.email ?? "—"}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MemberEditForm member={member} />
        <aside className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-zinc-900">Luma data</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500">
                First seen
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-zinc-900">
                {formatDate(member.first_seen)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500">
                Events approved
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-zinc-900">
                {member.event_approved_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500">
                Events checked in
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums text-zinc-900">
                {member.event_checked_in_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500">
                User API ID
              </dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-zinc-700">
                {member.user_api_id}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
