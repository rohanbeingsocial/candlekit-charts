#!/usr/bin/env node
/**
 * Records short looping GIFs of the demos for the README / landing hero by
 * driving a deployed (or local) demo with Playwright, screenshotting frames,
 * and encoding with gifenc — no ffmpeg required.
 *
 * Prereqs (installed ad-hoc, not committed as deps):
 *   playwright-core  (drives system Chrome via channel:"chrome" — no download)
 *   gifenc, pngjs    (pure-JS GIF encode)
 *
 * Usage:
 *   SCENE=drawing node scripts/capture-demo.mjs       # one of: drawing|indicators|replay
 *   SCENE=all     node scripts/capture-demo.mjs       # all three
 *
 * Env: BASE (default the deployed Pages URL — pass a localhost vite URL for a
 *      local example), WIDTH (1000), HEIGHT (640), DELAY_MS (140), MAXFRAMES (54),
 *      SCENE (all). Output: scripts/site-assets/<scene>.gif.
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
const BASE = (env.BASE || "https://rohanbeingsocial.github.io/candlekit-charts/").replace(/\/?$/, "/");
const WIDTH = Number(env.WIDTH || 1000);
const HEIGHT = Number(env.HEIGHT || 640);
const DELAY_MS = Number(env.DELAY_MS || 140);
const MAXFRAMES = Number(env.MAXFRAMES || 54);
const SCENE = env.SCENE || "all";
const outDir = resolve(__dirname, "site-assets");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Continuously screenshot into `frames` until `stop()` is called. */
function startCapture(page, frames) {
  let on = true;
  const loop = (async () => {
    while (on && frames.length < MAXFRAMES) {
      frames.push(await page.screenshot({ type: "png" }));
      await sleep(DELAY_MS);
    }
  })();
  return async () => {
    on = false;
    await loop;
  };
}

// ── Per-scene interaction. Chart area is roughly x[230..900], y[210..470]. ──
const SCENES = {
  async drawing(page) {
    await page.locator(".ck-toolbar").waitFor({ state: "visible", timeout: 20000 });
    await sleep(700);
    const draw = async (title, a, b) => {
      await page.locator(`button[title="${title}"]`).click();
      await page.mouse.move(a[0], a[1]);
      await sleep(220);
      await page.mouse.click(a[0], a[1]);
      await sleep(220);
      await page.mouse.move(b[0], b[1]);
      await sleep(260);
      await page.mouse.click(b[0], b[1]);
      await sleep(450);
    };
    await draw("Trend line", [250, 430], [780, 250]);
    await draw("Rectangle", [330, 300], [560, 410]);
    await draw("Fibonacci retracement", [600, 250], [880, 400]);
    await sleep(700);
  },

  async indicators(page) {
    await page.locator(".ck-picker").waitFor({ state: "visible", timeout: 20000 });
    await sleep(900);
    for (const label of ["Bollinger Bands", "MACD", "Simple Moving Average", "Stochastic Oscillator"]) {
      await page.getByText(label, { exact: true }).click();
      await sleep(750);
    }
  },

  async replay(page) {
    const play = page.locator('button[title="Play"]');
    await play.waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('button[title="Play"]');
      return b && !b.disabled;
    }, { timeout: 20000 });
    await page.selectOption(".ck-replay-speed", "16").catch(() => {});
    await play.click();
    await sleep(2200); // pre-roll so candles accumulate
  },
};

async function capture(browser, scene) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.goto(BASE + scene + "/", { waitUntil: "networkidle", timeout: 30000 });
  const frames = [];
  const stop = startCapture(page, frames);
  await SCENES[scene](page);
  await sleep(400);
  await stop();
  await page.close();

  const gif = GIFEncoder();
  for (const buf of frames) {
    const { width, height, data } = PNG.sync.read(buf);
    const palette = quantize(data, 256, { format: "rgba4444" });
    const index = applyPalette(data, palette, "rgba4444");
    gif.writeFrame(index, width, height, { palette, delay: DELAY_MS });
  }
  gif.finish();
  const out = resolve(outDir, `${scene}.gif`);
  writeFileSync(out, Buffer.from(gif.bytes()));
  console.log(`✅ ${out} — ${frames.length} frames ${WIDTH}x${HEIGHT}`);
}

const scenes = SCENE === "all" ? ["drawing", "indicators", "replay"] : [SCENE];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const s of scenes) await capture(browser, s);
} finally {
  await browser.close();
}
