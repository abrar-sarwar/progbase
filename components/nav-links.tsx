"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Members" },
  { href: "/eboard", label: "E-board" },
  { href: "/analytics", label: "Analytics" },
  { href: "/import", label: "Import" },
  { href: "/blacklist", label: "Blacklist" },
];

export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="hidden items-center gap-6 md:flex">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
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
  );
}
