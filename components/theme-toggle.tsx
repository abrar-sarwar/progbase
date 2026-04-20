"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function persist(theme: "dark" | "light") {
  try {
    localStorage.setItem("progbase-theme", theme);
  } catch {}
  document.cookie = `progbase-theme=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function applyTheme(next: boolean) {
    const root = document.documentElement;
    if (next) root.classList.add("dark");
    else root.classList.remove("dark");
    persist(next ? "dark" : "light");
    setIsDark(next);
  }

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    const doc = document as ViewTransitionDoc;

    // Prefer the View Transitions API with a circle reveal from the toggle.
    if (
      typeof doc.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const rect = btnRef.current?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth - 60;
      const cy = rect ? rect.top + rect.height / 2 : 28;
      const endRadius = Math.hypot(
        Math.max(cx, window.innerWidth - cx),
        Math.max(cy, window.innerHeight - cy),
      );

      root.classList.add("vt-running");
      const transition = doc.startViewTransition(() => applyTheme(next));

      transition.ready.then(() => {
        const clipFrom = `circle(0px at ${cx}px ${cy}px)`;
        const clipTo = `circle(${endRadius}px at ${cx}px ${cy}px)`;
        root.animate(
          { clipPath: [clipFrom, clipTo] },
          {
            duration: 340,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });

      transition.finished.finally(() => {
        root.classList.remove("vt-running");
      });
      return;
    }

    // Fallback: scoped class-based cross-fade for Firefox / older browsers.
    root.classList.add("theme-transitioning");
    requestAnimationFrame(() => {
      applyTheme(next);
      window.setTimeout(() => {
        root.classList.remove("theme-transitioning");
      }, 280);
    });
  }

  const showSun = isDark === true;

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      aria-label={showSun ? "Switch to light mode" : "Switch to dark mode"}
      title={showSun ? "Light mode" : "Dark mode"}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-white dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 dark:focus:ring-offset-zinc-950",
        className,
      )}
    >
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
