import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4">
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.4]" />
      <div className="relative z-10 mb-8 flex items-baseline gap-2">
        <span
          aria-hidden
          className="block h-3 w-3 rotate-45 rounded-[2px] bg-indigo-600"
        />
        <span className="font-display text-2xl font-semibold italic tracking-tight-2 text-zinc-900">
          progbase
        </span>
      </div>
      <div className="relative z-10">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm",
              card: "border border-zinc-200 shadow-[0_1px_0_rgba(9,9,11,0.04)] rounded-lg bg-white",
              headerTitle: "font-display text-zinc-900 font-light",
              headerSubtitle: "text-zinc-500",
              socialButtonsBlockButton:
                "border-zinc-200 hover:bg-zinc-50 text-zinc-900",
              formButtonPrimary: "bg-zinc-900 hover:bg-zinc-800",
              footerActionText: "text-zinc-500",
              footerActionLink: "text-indigo-600 hover:text-indigo-700",
            },
          }}
        />
      </div>
      <p className="relative z-10 mt-6 max-w-xs text-center text-xs text-zinc-500">
        Google account only. If you&apos;re on the e-board allowlist, you land
        on the dashboard. Otherwise, you&apos;ll see a polite decline.
      </p>
    </main>
  );
}
