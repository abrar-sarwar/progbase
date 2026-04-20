import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAllowed } from "@/lib/allowlist";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/unauthorized"]);

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
