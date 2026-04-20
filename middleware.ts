import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/_never_matches_disabled_middleware"],
};
