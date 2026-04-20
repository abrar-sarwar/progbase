import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAllowed } from "@/lib/allowlist";
import { Header } from "@/components/header";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");
  if (!isAllowed(session.user.email, process.env.ALLOWED_EMAILS)) {
    redirect("/unauthorized");
  }

  return (
    <>
      <Header />
      {children}
    </>
  );
}
