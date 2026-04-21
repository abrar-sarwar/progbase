"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  disabled?: boolean;
  tag?: string;
};

const NAV: NavItem[] = [
  { href: "/events", label: "Events", disabled: true, tag: "in the works" },
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
        if (item.disabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className="relative flex h-14 items-center gap-1.5 text-[13px] font-medium text-zinc-400 dark:text-zinc-500"
            >
              {item.label}
              {item.tag && (
                <span className="text-[10px] font-normal italic text-zinc-400 dark:text-zinc-500">
                  ({item.tag})
                </span>
              )}
            </span>
          );
        }
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
