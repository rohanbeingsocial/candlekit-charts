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
import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const siteDir = resolve(repoRoot, "site");

// `workspace` is the headline unified workspace (split chart panes; each pane
// owns drawing, indicators, measurement, replay). The rest are focused examples
// that isolate one part of the API. All deploy so the landing can link them.
// Order = build order.
const EXAMPLES = ["workspace", "vanilla", "react", "indicators", "drawing", "replay", "lab"];

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

// Landing page + any static assets (the showcase .gif files, social images,
// robots.txt, .well-known/security.txt) live in scripts/site-assets/ and are
// copied verbatim (recursively) to the site root.
const assetsDir = resolve(__dirname, "site-assets");
if (existsSync(assetsDir)) {
  for (const entry of readdirSync(assetsDir)) {
    cpSync(join(assetsDir, entry), join(siteDir, entry), { recursive: true });
    console.log(`copied asset: ${entry}`);
  }
}

// Security meta tags, injected into every deployed page at build time only so
// dev servers (Vite HMR websockets) are unaffected. GitHub Pages cannot set
// HTTP response headers, so meta tags are the ceiling here: CSP via
// http-equiv works for resource directives (frame-ancestors / sandbox /
// report-uri are ignored in meta per spec), Referrer-Policy has a meta
// equivalent, X-Content-Type-Options does not (header-only — not achievable
// on Pages). 'unsafe-inline' for styles: the landing page uses an inline
// <style> block and the demos set style attributes; scripts stay 'self'-only.
const SECURITY_META = [
  `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'" />`,
  `<meta name="referrer" content="strict-origin-when-cross-origin" />`,
].join("\n    ");

function injectSecurityMeta(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  if (html.includes("Content-Security-Policy")) return;
  writeFileSync(htmlPath, html.replace(/<head>/i, `<head>\n    ${SECURITY_META}`));
  console.log(`security meta → ${htmlPath}`);
}

injectSecurityMeta(join(siteDir, "index.html"));
for (const name of EXAMPLES) {
  injectSecurityMeta(join(siteDir, name, "index.html"));
}

console.log(`\n✅ Site built at ${siteDir}`);
console.log(`   base = ${SITE_BASE}`);
console.log(`   examples = ${EXAMPLES.join(", ")}`);
