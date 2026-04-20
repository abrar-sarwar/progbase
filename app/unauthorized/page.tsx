import { SignOutButton } from "@clerk/nextjs";
import Image from "next/image";
import logo from "../../public/progbase.png";

export default function UnauthorizedPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 text-center dark:bg-zinc-950">
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center">
        <Image
          src={logo}
          alt=""
          width={56}
          height={56}
          priority
          className="h-14 w-14 rounded-xl object-cover opacity-40 ring-1 ring-black/10 grayscale dark:ring-white/10"
        />
        <span className="mt-6 text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
          403 · not on list
        </span>
        <h1 className="mt-3 font-display text-[44px] font-normal leading-[1.05] tracking-tight-2 text-zinc-900 dark:text-zinc-50">
          Not your dashboard.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          progbase is an internal tool for the progsu e-board. If you need
          access, reach out to the VP. Otherwise, sign out and try a different
          Google account.
        </p>
        <div className="mt-8">
          <SignOutButton redirectUrl="/sign-in">
            <button className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
