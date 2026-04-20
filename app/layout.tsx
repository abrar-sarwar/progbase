import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "progbase",
  description: "Internal dashboard for progsu (GSU)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <body className="min-h-screen">{children}</body>
      </html>
    </ClerkProvider>
  );
}
