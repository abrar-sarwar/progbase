/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force Next to transpile Clerk's shared + backend packages so the Edge
  // middleware bundler walks their module graph directly instead of
  // treating them as pre-built externals.
  transpilePackages: ["@clerk/nextjs", "@clerk/shared", "@clerk/backend"],

  webpack: (config, { nextRuntime }) => {
    // Clerk's @clerk/nextjs defines `#safe-node-apis` with only `node`
    // and `default` conditions — no `edge-light`. Vercel's Edge bundler
    // was picking the `node` implementation (which imports `node:fs`)
    // instead of falling through to `default` (the safe browser stubs).
    // Strip `node` from the condition list when bundling for Edge so
    // resolution falls through correctly.
    if (nextRuntime === "edge") {
      config.resolve = config.resolve || {};
      const existing = config.resolve.conditionNames || [
        "edge-light",
        "worker",
        "browser",
        "module",
        "import",
        "require",
        "default",
      ];
      config.resolve.conditionNames = Array.from(
        new Set([
          "edge-light",
          "worker",
          "browser",
          ...existing.filter((c) => c !== "node"),
        ]),
      );
    }
    return config;
  },
};

export default nextConfig;
