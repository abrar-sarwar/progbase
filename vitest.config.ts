import { defineConfig } from "vitest/config";
import path from "node:path";

// Provide dummy Supabase env vars so lib/supabase-server.ts can initialize
// during tests that never actually touch the network (they inject fake DBs).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // In unit tests we never hit a real Next.js server; 'server-only' is a
      // build-time marker we can safely neutralize. Without this, importing
      // any lib/* module that declares 'import "server-only"' throws.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
      // Mirror the Next.js `@/*` path alias so tests can import modules the
      // same way production code does (e.g. `@/lib/csv-format`).
      "@": path.resolve(__dirname, "."),
    },
  },
});
