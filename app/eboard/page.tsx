import { listVisibleMembers } from "@/lib/members";
import { MembersTable } from "@/components/members-table";
import { isEboard, missingFromRoster, EBOARD_NAMES } from "@/lib/eboard";

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default async function EboardPage() {
  const all = await listVisibleMembers();
  const eboardMembers = all.filter((m) => isEboard(m.name));
  const missing = missingFromRoster(all.map((m) => m.name));

  const hasMembers = eboardMembers.length > 0;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      {hasMembers ? (
        <MembersTable
          members={eboardMembers}
          title="E-board"
          eyebrow="Leadership"
          unitSingular="member"
          unitPlural="members"
        />
      ) : (
        <div className="mb-8">
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
            Leadership
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900">
            E-board
          </h1>
          <p className="mt-3 max-w-md text-sm text-zinc-500">
            No e-board members have attended a Luma event yet, so none appear
            in the roster. The list of expected names is below.
          </p>
        </div>
      )}

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
              Not yet in roster
            </span>
            <h2 className="mt-1 font-display text-xl font-normal tracking-tight-2 text-zinc-900">
              {missing.length === 0
                ? "Everyone's accounted for"
                : `${missing.length} ${missing.length === 1 ? "person" : "people"} missing`}
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums text-zinc-500">
            {EBOARD_NAMES.length} total on list
          </span>
        </div>
        {missing.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            Every e-board name maps to a member in the Luma roster.
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="mb-3 text-xs text-zinc-500">
              These names are on the e-board list in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
                lib/eboard.ts
              </code>{" "}
              but have no matching member in the roster. Either they
              haven&apos;t attended a Luma event yet, or their Luma name
              differs from the one on the list.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <li
                  key={m}
                  className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
                >
                  {titleCase(m)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
