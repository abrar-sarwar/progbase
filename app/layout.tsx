import type { Metadata } from "next";
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
    <html lang="en" className="bg-white text-zinc-900 antialiased">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
