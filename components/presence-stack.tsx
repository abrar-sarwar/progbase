"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/cn";

type Viewer = {
  key: string;
  email: string;
  name: string;
  imageUrl: string | null;
  joinedAt: number;
};

const CHANNEL = "progbase:presence";
const MAX_SHOWN = 4;

function initials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function colorSeed(s: string): string {
  // deterministic pastel hue from email
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 55%)`;
}

export function PresenceStack() {
  const { user, isLoaded } = useUser();
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const email =
      user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
    if (!email) return;

    const me: Viewer = {
      key: email.toLowerCase(),
      email,
      name: user.fullName ?? user.firstName ?? email,
      imageUrl: user.imageUrl ?? null,
      joinedAt: Date.now(),
    };

    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: me.key } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Viewer>();
        const flat: Viewer[] = [];
        for (const list of Object.values(state)) {
          for (const v of list) flat.push(v);
        }
        // Dedupe by key (multiple tabs per user) keeping the earliest join.
        const uniq = new Map<string, Viewer>();
        for (const v of flat) {
          const prev = uniq.get(v.key);
          if (!prev || v.joinedAt < prev.joinedAt) uniq.set(v.key, v);
        }
        setViewers(
          Array.from(uniq.values()).sort((a, b) => a.joinedAt - b.joinedAt),
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(me);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [isLoaded, user]);

  if (viewers.length === 0) return null;

  const me = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  const others = viewers.filter((v) => v.key !== me);
  if (others.length === 0) return null;

  const shown = others.slice(0, MAX_SHOWN);
  const hiddenCount = others.length - shown.length;

  return (
    <div
      className="flex items-center"
      aria-label={`${others.length} other ${others.length === 1 ? "viewer" : "viewers"} online`}
    >
      {shown.map((v, i) => (
        <Avatar key={v.key} viewer={v} stackIndex={i} />
      ))}
      {hiddenCount > 0 && (
        <span
          className={cn(
            "relative -ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-[10px] font-semibold text-zinc-700 dark:border-zinc-950 dark:bg-zinc-700 dark:text-zinc-200",
          )}
          title={`${hiddenCount} more`}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

function Avatar({ viewer, stackIndex }: { viewer: Viewer; stackIndex: number }) {
  const fallback = initials(viewer.name, viewer.email);
  const bg = colorSeed(viewer.email);
  const zIndex = 10 - stackIndex;

  return (
    <div
      className="group relative"
      style={{ zIndex, marginLeft: stackIndex === 0 ? 0 : -8 }}
    >
      {viewer.imageUrl ? (
        <img
          src={viewer.imageUrl}
          alt=""
          className="h-7 w-7 rounded-full border-2 border-white object-cover shadow-sm transition-transform hover:scale-110 dark:border-zinc-950"
        />
      ) : (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm transition-transform hover:scale-110 dark:border-zinc-950"
          style={{ backgroundColor: bg }}
        >
          {fallback}
        </span>
      )}
      <span
        className="pointer-events-none absolute right-1/2 top-full z-50 mt-1.5 translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-900 opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
        role="tooltip"
      >
        <span className="block">{viewer.name}</span>
        <span className="block font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
          {viewer.email}
        </span>
      </span>
      <span
        aria-hidden
        className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-950"
      />
    </div>
  );
}
