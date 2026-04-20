import { SignOutButton } from "@clerk/nextjs";

export default function UnauthorizedPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.4]" />
      <div className="relative z-10 flex flex-col items-center">
        <span
          aria-hidden
          className="mb-6 block h-3 w-3 rotate-45 rounded-[2px] bg-zinc-400"
        />
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
          403 · not on list
        </span>
        <h1 className="mt-3 font-display text-5xl font-light tracking-tight-2 text-zinc-900">
          Not your dashboard.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-600">
          progbase is an internal tool for the progsu e-board. If you need
          access, reach out to the VP. Otherwise, sign out and try a different
          Google account.
        </p>
        <div className="mt-8">
          <SignOutButton redirectUrl="/sign-in">
            <button className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
