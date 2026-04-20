import Image from "next/image";
import { signIn } from "@/auth";
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
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
        className="relative z-10"
      >
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-3 rounded-md border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 shadow-[0_1px_0_rgba(9,9,11,0.04)] transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          <GoogleMark />
          Sign in with Google
        </button>
      </form>
      <p className="relative z-10 mt-6 max-w-xs text-center text-xs text-zinc-500 dark:text-zinc-400">
        Google account only. If you&apos;re on the e-board allowlist, you land
        on the dashboard. Otherwise, you&apos;ll see a polite decline.
      </p>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        d="M21.6 12.227c0-.818-.073-1.604-.21-2.36H12v4.465h5.385a4.603 4.603 0 0 1-1.995 3.018v2.51h3.228c1.89-1.739 2.982-4.3 2.982-7.633Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.963-.895 6.618-2.42l-3.228-2.51c-.895.6-2.04.954-3.39.954-2.605 0-4.81-1.759-5.598-4.123H3.067v2.59A9.996 9.996 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.402 13.901A5.996 5.996 0 0 1 6.09 12c0-.66.114-1.3.313-1.9V7.51H3.067A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.067 4.49l3.335-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.47 0 2.786.505 3.823 1.497l2.868-2.868C16.96 2.99 14.697 2 12 2A9.996 9.996 0 0 0 3.067 7.51L6.4 10.1C7.192 7.736 9.395 5.977 12 5.977Z"
        fill="#EA4335"
      />
    </svg>
  );
}
