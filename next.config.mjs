/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force Next to transpile Clerk's shared + backend packages so the Edge
  // middleware bundler resolves their subpath conditional exports
  // (#crypto, #safe-node-apis) against the "edge-light" condition instead
  // of falling back to node-only implementations. Without this Vercel
  // fails the build with "unsupported modules" on @clerk/shared.
  transpilePackages: ["@clerk/nextjs", "@clerk/shared", "@clerk/backend"],
};

export default nextConfig;
