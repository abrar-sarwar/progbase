#!/usr/bin/env node
/**
 * Adds `edge-light` / `workerd` / `worker` / `browser` conditions to
 * @clerk/nextjs's `#safe-node-apis` internal subpath import in both the
 * esm and cjs dist/package.jsons. Without this, Vercel's Edge Function
 * validator resolves the `node` condition and flags `node:fs` as an
 * unsupported module, breaking deploys.
 *
 * Runs as a prebuild step so it's guaranteed to execute on Vercel
 * (unlike postinstall, which can silently skip). Idempotent — if the
 * conditions are already in place it does nothing and exits cleanly.
 *
 * Can be removed once @clerk/nextjs upstreams these conditions.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  "node_modules/@clerk/nextjs/dist/esm/package.json",
  "node_modules/@clerk/nextjs/dist/cjs/package.json",
];

const NEW_CONDITIONS = ["edge-light", "workerd", "worker", "browser"];

let changed = 0;
let missing = 0;

for (const relPath of TARGETS) {
  const path = resolve(process.cwd(), relPath);
  if (!existsSync(path)) {
    missing++;
    console.warn(`[patch-clerk-edge] not found: ${relPath}`);
    continue;
  }

  const raw = readFileSync(path, "utf-8");
  const json = JSON.parse(raw);
  const imp = json?.imports?.["#safe-node-apis"];
  if (!imp || typeof imp !== "object") {
    console.warn(
      `[patch-clerk-edge] #safe-node-apis not found in ${relPath}; skipping`,
    );
    continue;
  }

  const defaultPath = imp.default;
  if (!defaultPath) {
    console.warn(
      `[patch-clerk-edge] no default path in #safe-node-apis for ${relPath}; skipping`,
    );
    continue;
  }

  const already = NEW_CONDITIONS.every((c) => imp[c] === defaultPath);
  if (already) {
    console.log(`[patch-clerk-edge] already patched: ${relPath}`);
    continue;
  }

  // Build a new imports object with the new conditions prepended,
  // preserving existing node/default keys.
  const patched = {};
  for (const c of NEW_CONDITIONS) patched[c] = defaultPath;
  for (const key of Object.keys(imp)) patched[key] = imp[key];

  json.imports["#safe-node-apis"] = patched;
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`[patch-clerk-edge] patched: ${relPath}`);
  changed++;
}

if (missing === TARGETS.length) {
  console.log(
    "[patch-clerk-edge] all targets missing — @clerk/nextjs not installed yet; skipping",
  );
}

process.exit(0);
