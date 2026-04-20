import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { headers } from "next/headers";
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

// Set theme class before paint to avoid a white flash on first render.
const themeBootstrap = `
try {
  var stored = localStorage.getItem('progbase-theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = stored === 'dark' || (stored !== 'light' && prefersDark);
  if (dark) document.documentElement.classList.add('dark');
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

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-50">
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
