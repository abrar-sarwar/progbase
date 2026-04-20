import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowed } from "./lib/allowlist";

export default {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async signIn({ user }) {
      if (!isAllowed(user.email, process.env.ALLOWED_EMAILS)) {
        return "/unauthorized";
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
