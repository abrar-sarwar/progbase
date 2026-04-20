import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAllowed } from "./lib/allowlist";

export async function middleware(req: NextRequest) {
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

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    salt:
      process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
    secureCookie: process.env.NODE_ENV === "production",
  });
  const email = token?.email as string | undefined;

  if (!email) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
