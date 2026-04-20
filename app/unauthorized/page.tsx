import { SignOutButton } from "@clerk/nextjs";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center">
      <span className="mb-6 inline-block h-4 w-4 rounded-sm bg-indigo-600" />
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        You&apos;re not authorized for progbase.
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        Contact the progsu VP to request access. If you think this is a mistake,
        sign out and try a different Google account.
      </p>
      <div className="mt-6">
        <SignOutButton redirectUrl="/sign-in">
          <button className="inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}
