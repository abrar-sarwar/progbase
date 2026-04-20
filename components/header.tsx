import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/chip";
import { ThemeToggle } from "@/components/theme-toggle";
import { PresenceStack } from "@/components/presence-stack";
import { getLastImport, isStale, staleDays } from "@/lib/freshness";
import logo from "../public/progbase.png";

const NAV = [
  { href: "/", label: "Members" },
  { href: "/eboard", label: "E-board" },
  { href: "/analytics", label: "Analytics" },
  { href: "/import", label: "Import" },
  { href: "/blacklist", label: "Blacklist" },
];

export async function Header({ currentPath }: { currentPath: string }) {
  const last = await getLastImport();
  const dismissed =
    (await cookies()).get("progbase_stale_dismissed")?.value === "1";
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
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-14 items-center text-[13px] font-medium transition-colors",
                  active
                    ? "text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-violet-600 dark:bg-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>
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
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox:
                  "h-7 w-7 ring-1 ring-zinc-200 dark:ring-zinc-700",
                userButtonTrigger:
                  "focus:shadow-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
