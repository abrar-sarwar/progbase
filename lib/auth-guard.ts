import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAllowed } from "./allowlist";

const PUBLIC_PREFIXES = ["/sign-in", "/unauthorized"];

export async function requireAuthorized(pathname: string): Promise<void> {
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return;

  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const email = (sessionClaims?.email as string | undefined) ?? null;
  if (!isAllowed(email, process.env.ALLOWED_EMAILS)) {
    redirect("/unauthorized");
  }
}
