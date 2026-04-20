#!/usr/bin/env node
/**
 * Rewrites Clerk's internal subpath imports so that Vercel's Edge Function
 * validator can't reach any `node:*` modules through them.
 *
 * Even when Clerk declares `edge-light`/`worker`/`browser` conditions
 * upstream (e.g. @clerk/backend's `#crypto`), Vercel's validator still
 * flags the subpath because the `node` condition points at a file
 * containing `node:fs`/`node:crypto`/etc. The fix is to rewrite every
 * condition — including `node` — to the browser-safe variant. At runtime
 * Node 18+ has Web Crypto globally and the browser #safe-node-apis
 * variant is already a no-op stub, so rewriting `node` is safe for the
 * server side too.
 *
 * Runs as a prebuild step so it's guaranteed to execute on Vercel.
 * Idempotent: skips packages already patched.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  {
    file: "node_modules/@clerk/nextjs/dist/esm/package.json",
    importKey: "#safe-node-apis",
  },
  {
    file: "node_modules/@clerk/nextjs/dist/cjs/package.json",
    importKey: "#safe-node-apis",
  },
  {
    file: "node_modules/@clerk/backend/package.json",
    importKey: "#crypto",
  },
];

const CONDITIONS = ["edge-light", "workerd", "worker", "browser", "node"];

let patchedCount = 0;
let missingCount = 0;

for (const { file, importKey } of TARGETS) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) {
    missingCount++;
    console.warn(`[patch-clerk-edge] not found: ${file}`);
    continue;
  }

  const raw = readFileSync(path, "utf-8");
  const json = JSON.parse(raw);
  const imp = json?.imports?.[importKey];
  if (!imp || typeof imp !== "object") {
    console.warn(
      `[patch-clerk-edge] ${importKey} not found in ${file}; skipping`,
    );
    continue;
  }

  const safePath = imp.default ?? imp["edge-light"] ?? imp.browser;
  if (typeof safePath !== "string") {
    console.warn(
      `[patch-clerk-edge] no scalar browser-safe path in ${importKey} for ${file}; skipping`,
    );
    continue;
  }

  const already = CONDITIONS.every((c) => imp[c] === safePath);
  if (already && imp.default === safePath) {
    console.log(`[patch-clerk-edge] already patched: ${file} ${importKey}`);
    continue;
  }

  const patched = {};
  for (const c of CONDITIONS) patched[c] = safePath;
  patched.default = safePath;

  json.imports[importKey] = patched;
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`[patch-clerk-edge] patched: ${file} ${importKey}`);
  patchedCount++;
}

if (missingCount === TARGETS.length) {
  console.log(
    "[patch-clerk-edge] all targets missing — Clerk not installed yet; skipping",
  );
}

process.exit(0);
