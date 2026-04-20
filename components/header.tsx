import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/chip";
import { getLastImport, isStale, staleDays } from "@/lib/freshness";

const NAV = [
  { href: "/", label: "Members" },
  { href: "/analytics", label: "Analytics" },
  { href: "/import", label: "Import" },
  { href: "/blacklist", label: "Blacklist" },
];

export async function Header({ currentPath }: { currentPath: string }) {
  const last = await getLastImport();
  const dismissed =
    cookies().get("progbase_stale_dismissed")?.value === "1";
  const stale = isStale(last?.uploaded_at ?? null);
  const days = staleDays(last?.uploaded_at ?? null);
  const showStale = stale && !dismissed;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
      <div className="flex h-14 items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2"
          aria-label="progbase home"
        >
          <span
            aria-hidden
            className="block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-indigo-600 transition-transform duration-300 group-hover:rotate-[225deg]"
          />
          <span className="font-display text-[18px] font-semibold leading-none tracking-tight text-zinc-900">
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
                    ? "text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-indigo-600" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
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
                className="rounded-sm px-1 text-xs text-amber-700 hover:bg-amber-100"
              >
                ×
              </button>
            </form>
          )}
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-7 w-7 ring-1 ring-zinc-200",
                userButtonTrigger:
                  "focus:shadow-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
