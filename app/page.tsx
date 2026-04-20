import { listVisibleMembers } from "@/lib/members";
import { MembersTable } from "@/components/members-table";
import Link from "next/link";

export default async function MembersPage() {
  const members = await listVisibleMembers();
  const empty = members.length === 0;

  if (empty) {
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center">
          <h1 className="text-sm font-medium text-zinc-900">
            No members imported yet
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Upload the Luma CSV to populate the dashboard.
          </p>
          <Link
            href="/import"
            className="mt-4 inline-flex h-8 items-center rounded-md bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Upload CSV
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-6">
      <MembersTable members={members} />
    </main>
  );
}
