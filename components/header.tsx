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
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-block h-3.5 w-3.5 rounded-sm bg-indigo-600" />
        <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
          progbase
        </span>
      </Link>
      <nav className="flex items-center gap-6">
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
                "relative flex h-12 items-center text-sm transition-colors",
                active
                  ? "text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              {item.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-indigo-600" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        {showStale && days !== null && (
          <form
            action="/api/stale-banner/dismiss"
            method="post"
            className="flex items-center gap-1"
          >
            <Link href="/import">
              <Chip tone="amber">CSV {days}d stale — re-upload</Chip>
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
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              userButtonAvatarBox: "h-7 w-7",
            },
          }}
        />
      </div>
    </header>
  );
}
