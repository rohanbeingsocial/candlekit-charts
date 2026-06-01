#!/usr/bin/env node
/**
 * Builds the combined demo site for GitHub Pages.
 *
 * Each example under `examples/<name>` is its own Vite app that consumes the
 * library straight from `src/` via the shared alias. This script builds each
 * one into `site/<name>/` with the correct public base path, then drops a
 * landing page at `site/index.html` linking them together.
 *
 * Base path: GitHub Pages serves a project repo at
 *   https://<user>.github.io/<repo>/
 * so assets must be requested from `/<repo>/<name>/...`. Override with
 *   SITE_BASE=/ node scripts/build-site.mjs        # local root preview
 * Default is `/candlekit-charts/` (the repo name).
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const siteDir = resolve(repoRoot, "site");

// `workspace` is the headline all-in-one demo; the rest are focused examples.
// All deploy so the landing can link them. Order = build order.
const EXAMPLES = ["workspace", "workspace-demo", "vanilla", "react", "indicators", "drawing", "replay"];

const SITE_BASE = (process.env.SITE_BASE || "/candlekit-charts/").replace(/\/?$/, "/");

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}   (cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

// Fresh output dir.
rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

for (const name of EXAMPLES) {
  const exampleDir = resolve(repoRoot, "examples", name);
  const outDir = resolve(siteDir, name);
  const base = `${SITE_BASE}${name}/`;

  if (!existsSync(resolve(exampleDir, "node_modules"))) {
    run("npm install --no-audit --no-fund", exampleDir);
  }
  // --emptyOutDir is required because outDir lives outside the example root.
  run(`npm run build -- --base "${base}" --outDir "${outDir}" --emptyOutDir`, exampleDir);
}

// Landing page + any static assets (the showcase .gif files, social images)
// live in scripts/site-assets/ and are copied verbatim to the site root.
const assetsDir = resolve(__dirname, "site-assets");
if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    copyFileSync(join(assetsDir, file), join(siteDir, file));
    console.log(`copied asset: ${file}`);
  }
}

console.log(`\n✅ Site built at ${siteDir}`);
console.log(`   base = ${SITE_BASE}`);
console.log(`   examples = ${EXAMPLES.join(", ")}`);
