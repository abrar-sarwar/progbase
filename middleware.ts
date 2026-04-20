import { NextResponse } from "next/server";
import { auth } from "./auth";
import { isAllowed } from "./lib/allowlist";

export default auth((req) => {
  const { nextUrl } = req;
  const res = NextResponse.next();
  res.headers.set("x-pathname", nextUrl.pathname);

  const pathname = nextUrl.pathname;
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/unauthorized")
  ) {
    return res;
  }

  const email = req.auth?.user?.email;
  if (!email) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
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
