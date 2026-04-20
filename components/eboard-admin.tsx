"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addEboardEntry, removeEboardEntry } from "@/app/(protected)/eboard/actions";

type Entry = {
  id: string;
  label: string;
  email: string | null;
  name: string | null;
  added_by: string;
};

export function EboardAdmin({
  missing,
  totalOnList,
}: {
  missing: Entry[];
  totalOnList: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await addEboardEntry({ label, email, name });
        setLabel("");
        setEmail("");
        setName("");
        setOpen(false);
        setNotice("Added. Refreshing…");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  function handleRemove(entry: Entry) {
    if (entry.id.startsWith("seed-")) {
      window.alert(
        "This entry is from the fallback seed list. Run the migration SQL in Supabase to make the roster editable.",
      );
      return;
    }
    const ok = window.confirm(`Remove ${entry.label} from the e-board list?`);
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeEboardEntry(entry.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Remove failed");
      }
    });
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Not yet in roster
          </span>
          <h2 className="mt-1 font-display text-xl font-normal tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            {missing.length === 0
              ? "Everyone's accounted for"
              : `${missing.length} ${missing.length === 1 ? "person" : "people"} missing`}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {totalOnList} total on list
          </span>
          <Button variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Add e-board member"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mb-4 grid gap-2 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto] dark:border-zinc-800 dark:bg-zinc-900">
          <Input
            placeholder="Display label (required)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            placeholder="Email (exact match)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Name (word match)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={isPending}>
            Add
          </Button>
          <p className="col-span-full text-[11px] text-zinc-500 dark:text-zinc-400">
            Provide email OR name (or both). Email wins for common first names
            like &ldquo;jamal&rdquo; that would false-match non-e-board
            members. Label is what shows in the &ldquo;not yet in
            roster&rdquo; list.
          </p>
          {error && (
            <p className="col-span-full text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      {notice && !error && (
        <p className="mb-3 text-xs text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {missing.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          Every e-board name maps to a member in the Luma roster.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            These entries in the <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">eboard_entries</code>{" "}
            table have no matching member. Either they haven&apos;t attended a
            Luma event yet, or their email/name differs from what Luma stored.
            Click &times; to remove from the list.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((entry) => (
              <li
                key={entry.id}
                className="group inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 py-1 pl-2 pr-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                title={entry.email ?? entry.name ?? entry.label}
              >
                <span>{entry.label}</span>
                {entry.email && (
                  <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                    {entry.email}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(entry)}
                  disabled={isPending}
                  aria-label={`Remove ${entry.label}`}
                  className="ml-1 rounded-sm px-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
