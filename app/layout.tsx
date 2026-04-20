import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "progbase",
  description: "Internal dashboard for progsu (GSU)",
};

const PUBLIC_PREFIXES = ["/sign-in", "/unauthorized"];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const pathname = headers().get("x-pathname") ?? "/";
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const showHeader = Boolean(userId) && !isPublic;

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      afterSignInUrl="/"
      afterSignUpUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#4f46e5",
          colorText: "#18181b",
          colorTextSecondary: "#71717a",
          colorBackground: "#ffffff",
          colorInputBackground: "#ffffff",
          colorInputText: "#18181b",
          borderRadius: "6px",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        },
      }}
    >
      <html lang="en" className="bg-white text-zinc-900 antialiased">
        <body className="min-h-screen">
          {showHeader && <Header currentPath={pathname} />}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
