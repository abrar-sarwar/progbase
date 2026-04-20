import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = 'nodejs';

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/unauthorized"]);

/**
 * Inlined here (instead of imported from lib/allowlist) so the Edge
 * middleware bundle stays entirely self-contained. Vercel's Edge bundler
 * was flagging the @/ path-aliased import as unsupported, and the logic
 * is small enough that duplication is cheaper than chasing bundling.
 * If the test suite's expectations change, update lib/allowlist.ts AND
 * this copy together.
 */
function isAllowed(
  email: string | null | undefined,
  rawAllowlist: string | undefined,
): boolean {
  if (!email) return false;
  if (!rawAllowlist) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  const entries = rawAllowlist
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return entries.includes(target);
}

export default clerkMiddleware(async (auth, req) => {
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);

  if (isPublicRoute(req)) return res;

  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  const email = (sessionClaims?.email as string | undefined) ?? null;
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
