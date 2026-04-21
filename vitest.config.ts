import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
      // server-only's package.json points the browser/default field at a
      // module that throws. Vite's client bundler picks that up during tests.
      // Replace it with a no-op stub for the node-run integration tests.
      "server-only": resolve(__dirname, "./tests/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
