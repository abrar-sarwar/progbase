import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-block h-4 w-4 rounded-sm bg-indigo-600" />
        <span className="text-lg font-semibold tracking-tight text-zinc-900">
          progbase
        </span>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "border border-zinc-200 shadow-none rounded-lg",
            headerTitle: "text-zinc-900",
            headerSubtitle: "text-zinc-500",
            socialButtonsBlockButton:
              "border-zinc-200 hover:bg-zinc-50 text-zinc-900",
            formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700",
            footerActionText: "text-zinc-500",
            footerActionLink: "text-indigo-600 hover:text-indigo-700",
          },
        }}
      />
      <p className="mt-6 text-xs text-zinc-500">
        Sign in with your Google account. If you&apos;re on the e-board
        allowlist, you&apos;ll be taken to the dashboard.
      </p>
    </main>
  );
}
