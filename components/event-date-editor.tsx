"use client";

import { useState, useTransition } from "react";
import { updateEventDate } from "@/app/(protected)/events/[id]/actions";

export function EventDateEditor({
  lumaEventId,
  initial,
}: {
  lumaEventId: string;
  initial: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ? initial.slice(0, 10) : "");
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-violet-600 hover:text-violet-700"
      >
        Edit date
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            await updateEventDate(
              lumaEventId,
              value ? `${value}T00:00:00.000Z` : null,
            );
            setEditing(false);
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        });
      }}
      className="flex items-center gap-2"
    >
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 rounded-md border border-zinc-200 px-2 text-sm dark:border-zinc-700"
      />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-violet-600 hover:text-violet-700"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-zinc-500 hover:text-zinc-700"
      >
        Cancel
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </form>
  );
}
