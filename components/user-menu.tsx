import { signOut, auth } from "@/auth";

function initials(name: string | null | undefined, email: string): string {
  const source = (name ?? "").trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export async function UserMenu() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) return null;

  const label = initials(user.name, user.email);

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/sign-in" });
      }}
    >
      <button
        type="submit"
        title={`Sign out · ${user.email}`}
        className="inline-flex h-7 items-center gap-2 rounded-full border border-zinc-200 bg-white px-1 pr-3 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="h-5 w-5 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[9px] font-semibold text-white">
            {label}
          </span>
        )}
        Sign out
      </button>
    </form>
  );
}
