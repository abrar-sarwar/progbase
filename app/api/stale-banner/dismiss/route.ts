import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { isAllowed } from "@/lib/allowlist";

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !isAllowed(email, process.env.ALLOWED_EMAILS)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const referer = headers().get("referer") ?? "/";
  const res = NextResponse.redirect(referer, { status: 303 });
  res.cookies.set("progbase_stale_dismissed", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
