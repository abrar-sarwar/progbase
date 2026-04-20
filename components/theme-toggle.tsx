"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("progbase-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("progbase-theme", "light");
    }
    setIsDark(next);
  }

  // Render a stable placeholder until we know the real state — avoids
  // a flash of the wrong icon on hydration.
  const showSun = isDark === true;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={showSun ? "Switch to light mode" : "Switch to dark mode"}
      title={showSun ? "Light mode" : "Dark mode"}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-white dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 dark:focus:ring-offset-zinc-950",
        className,
      )}
    >
      {/* Sun icon */}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        strokeWidth="1.6"
        stroke="currentColor"
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          showSun
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-50 opacity-0",
        )}
      >
        <circle cx="10" cy="10" r="3.2" />
        <path d="M10 1.5v2M10 16.5v2M3.5 10h-2M18.5 10h-2M4.7 4.7 3.3 3.3M16.7 16.7l-1.4-1.4M4.7 15.3l-1.4 1.4M16.7 3.3l-1.4 1.4" />
      </svg>
      {/* Moon icon */}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="currentColor"
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          showSun
            ? "rotate-90 scale-50 opacity-0"
            : "rotate-0 scale-100 opacity-100",
        )}
      >
        <path d="M14.5 12.5a6 6 0 0 1-8-8 6 6 0 1 0 8 8Z" />
      </svg>
    </button>
  );
}
