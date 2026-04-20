import { listVisibleMembers } from "@/lib/members";
import { MembersTable } from "@/components/members-table";
import { isEboard, missingFromRoster } from "@/lib/eboard";
import { listEboardEntries, toEntry, type EboardRow } from "@/lib/eboard-db";
import { EboardAdmin } from "@/components/eboard-admin";

export default async function EboardPage() {
  const [all, eboardRows] = await Promise.all([
    listVisibleMembers(),
    listEboardEntries(),
  ]);

  // Pair DB rows (which carry id + added_by) with their pure-shape entries.
  const rowsWithEntry: { row: EboardRow; entry: ReturnType<typeof toEntry> }[] =
    eboardRows.map((row) => ({ row, entry: toEntry(row) }));
  const eboardEntries = rowsWithEntry.map(({ entry }) => entry);

  const eboardMembers = all.filter((m) => isEboard(m, eboardEntries));

  // missingFromRoster on EboardRow[] so we keep the id/added_by for remove.
  const missing = missingFromRoster(all, eboardRows);

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
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Leadership
          </span>
          <h1 className="mt-1 font-display text-[32px] font-normal leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            E-board
          </h1>
          <p className="mt-3 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            No e-board members have attended a Luma event yet, so none appear
            in the roster. The list of expected names is below.
          </p>
        </div>
      )}

      <EboardAdmin missing={missing} totalOnList={eboardRows.length} />
    </main>
  );
}
