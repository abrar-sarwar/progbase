import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { cookies, headers } from "next/headers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans-ui",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "progbase",
  description: "Internal dashboard for progsu (GSU)",
};

const PUBLIC_PREFIXES = ["/sign-in", "/unauthorized"];

// Fallback for first-visit users whose cookie isn't set yet — honors
// prefers-color-scheme before React hydrates.
const themeBootstrap = `
try {
  if (!document.cookie.match(/(?:^|; )progbase-theme=/)) {
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const pathname = headers().get("x-pathname") ?? "/";
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const showHeader = Boolean(userId) && !isPublic;

  const themeCookie = cookies().get("progbase-theme")?.value;
  const isDark = themeCookie === "dark";

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sans.variable} ${mono.variable}${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">
        <ClerkProvider
          signInUrl="/sign-in"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          appearance={{
            variables: {
              colorPrimary: "#7c3aed",
              colorText: "#09090b",
              colorTextSecondary: "#71717a",
              colorBackground: "#ffffff",
              colorInputBackground: "#ffffff",
              colorInputText: "#09090b",
              borderRadius: "6px",
              fontFamily:
                "var(--font-sans-ui), ui-sans-serif, system-ui, sans-serif",
            },
          }}
        >
          {showHeader && <Header currentPath={pathname} />}
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
