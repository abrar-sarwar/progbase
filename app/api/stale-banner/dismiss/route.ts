import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST() {
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
