import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { Chip } from "@/components/ui/chip";
import { ThemeToggle } from "@/components/theme-toggle";
import { PresenceStack } from "@/components/presence-stack";
import { UserMenu } from "@/components/user-menu";
import { NavLinks } from "@/components/nav-links";
import { getLastImport, isStale, staleDays } from "@/lib/freshness";
import logo from "../public/progbase.png";

export async function Header() {
  const last = await getLastImport();
  const dismissed =
    cookies().get("progbase_stale_dismissed")?.value === "1";
  const stale = isStale(last?.uploaded_at ?? null);
  const days = staleDays(last?.uploaded_at ?? null);
  const showStale = stale && !dismissed;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-14 items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="progbase home"
        >
          <Image
            src={logo}
            alt=""
            width={28}
            height={28}
            priority
            className="h-7 w-7 shrink-0 rounded-md ring-1 ring-zinc-200/80 object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08] dark:ring-zinc-700/80"
          />
          <span className="font-display text-[19px] font-semibold italic leading-none tracking-tight-2 text-zinc-900 dark:text-zinc-50">
            progbase
          </span>
        </Link>
        <NavLinks />
        <div className="flex shrink-0 items-center gap-2">
          {showStale && days !== null && (
            <form
              action="/api/stale-banner/dismiss"
              method="post"
              className="hidden items-center gap-1 sm:flex"
            >
              <Link href="/import">
                <Chip tone="amber">CSV {days}d stale</Chip>
              </Link>
              <button
                type="submit"
                title="Dismiss for 24h"
                className="rounded-sm px-1 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                ×
              </button>
            </form>
          )}
          <PresenceStack />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
