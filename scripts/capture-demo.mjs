#!/usr/bin/env node
/**
 * Records a short looping GIF of the replay demo (candles streaming in) for the
 * README / landing hero. Drives the running example with Playwright, screenshots
 * frames, and encodes a GIF with gifenc — no ffmpeg required.
 *
 * Prereqs (installed ad-hoc, not committed as deps):
 *   playwright-core  (drives system Chrome via channel:"chrome" — no download)
 *   gifenc, pngjs    (pure-JS GIF encode)
 *
 * Usage:
 *   1. cd examples/replay && npm run dev      # serve on :5173
 *   2. node scripts/capture-demo.mjs          # with the 3 pkgs on NODE_PATH
 *
 * Env: URL (default http://localhost:5173), FRAMES (40), DELAY_MS (100),
 *      WIDTH (820), HEIGHT (520), SPEED (4), OUT (scripts/site-assets/preview.gif)
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const URL = env.URL || "http://localhost:5173";
const FRAMES = Number(env.FRAMES || 40);
const DELAY_MS = Number(env.DELAY_MS || 100);
const WIDTH = Number(env.WIDTH || 820);
const HEIGHT = Number(env.HEIGHT || 520);
const SPEED = env.SPEED || "4";
const OUT = resolve(__dirname, "..", env.OUT || "scripts/site-assets/preview.gif");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(URL, { waitUntil: "networkidle" });

  // Wait for the replay controller to finish loading (Play button enables).
  const play = page.locator('button[title="Play"]');
  await play.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(() => {
    const b = document.querySelector('button[title="Play"]');
    return b && !b.disabled;
  }, { timeout: 20000 });

  await page.selectOption(".ck-replay-speed", SPEED).catch(() => {});
  await sleep(300);
  await play.click();

  // Pre-roll: let some candles accumulate before recording so the first frame
  // isn't an empty chart.
  await sleep(Number(env.PREROLL_MS || 1500));

  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    frames.push(await page.screenshot({ type: "png" }));
    await sleep(DELAY_MS);
  }

  const gif = GIFEncoder();
  for (const buf of frames) {
    const { width, height, data } = PNG.sync.read(buf);
    const palette = quantize(data, 256, { format: "rgba4444" });
    const index = applyPalette(data, palette, "rgba4444");
    gif.writeFrame(index, width, height, { palette, delay: DELAY_MS });
  }
  gif.finish();
  writeFileSync(OUT, Buffer.from(gif.bytes()));
  console.log(`✅ wrote ${OUT} (${frames.length} frames, ${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
