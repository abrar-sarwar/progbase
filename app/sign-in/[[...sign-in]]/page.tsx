import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import logo from "../../../public/progbase.png";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="grain pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-violet-300/40 blur-3xl dark:bg-violet-600/20"
      />
      <div className="relative z-10 mb-8 flex flex-col items-center gap-3">
        <Image
          src={logo}
          alt=""
          width={72}
          height={72}
          priority
          className="h-16 w-16 rounded-xl ring-1 ring-black/10 object-cover shadow-lg shadow-violet-500/15 dark:ring-white/10 dark:shadow-violet-400/10"
        />
        <span className="font-display text-2xl font-semibold italic tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          progbase
        </span>
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
          progsu · internal
        </span>
      </div>
      <div className="relative z-10">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm",
              card: "border border-zinc-200 shadow-[0_1px_0_rgba(9,9,11,0.04)] rounded-lg bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none",
              headerTitle:
                "font-display text-zinc-900 font-normal dark:text-zinc-50",
              headerSubtitle: "text-zinc-500 dark:text-zinc-400",
              socialButtonsBlockButton:
                "border-zinc-200 hover:bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:text-zinc-50",
              formButtonPrimary:
                "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200",
              footerActionText: "text-zinc-500 dark:text-zinc-400",
              footerActionLink:
                "text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300",
            },
          }}
        />
      </div>
      <p className="relative z-10 mt-6 max-w-xs text-center text-xs text-zinc-500 dark:text-zinc-400">
        Google account only. If you&apos;re on the e-board allowlist, you land
        on the dashboard. Otherwise, you&apos;ll see a polite decline.
      </p>
    </main>
  );
}
