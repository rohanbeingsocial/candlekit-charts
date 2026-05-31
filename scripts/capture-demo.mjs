#!/usr/bin/env node
/**
 * Records short looping GIFs of the unified demo for the README / landing by
 * driving it with Playwright, screenshotting frames, and encoding with gifenc —
 * no ffmpeg required. All scenes run against the single `/workspace/` demo.
 *
 * Prereqs (installed ad-hoc, not committed as deps):
 *   playwright-core  (drives system Chrome via channel:"chrome" — no download)
 *   gifenc, pngjs    (pure-JS GIF encode)
 *
 * Usage:
 *   SCENE=drawing node scripts/capture-demo.mjs   # drawing|indicators|measurement|replay
 *   SCENE=all     node scripts/capture-demo.mjs
 *
 * Env: BASE (deployed Pages URL; pass a localhost vite URL for local), DEMO
 *      (path, default "workspace"), WIDTH (1180), HEIGHT (680), DELAY_MS (140),
 *      MAXFRAMES (52), SCENE (all). Output: scripts/site-assets/<scene>.gif.
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
const DEMO = env.DEMO || "workspace";
const WIDTH = Number(env.WIDTH || 1180);
const HEIGHT = Number(env.HEIGHT || 680);
const DELAY_MS = Number(env.DELAY_MS || 140);
const MAXFRAMES = Number(env.MAXFRAMES || 52);
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

// Chart drawing area inside the workspace layout: toolbar ~45px tall, drawing
// rail on the left (~x<50), indicator picker on the right (~x>770). Keep clicks
// within x[120..720], y[120..470].
const SCENES = {
  async drawing(page) {
    await page.locator(".ck-toolbar").waitFor({ state: "visible", timeout: 20000 });
    await sleep(700);
    const draw = async (title, a, b) => {
      await page.locator(`button[title="${title}"]`).click();
      await page.mouse.move(a[0], a[1]);
      await sleep(200);
      await page.mouse.click(a[0], a[1]);
      await sleep(220);
      await page.mouse.move(b[0], b[1]);
      await sleep(240);
      await page.mouse.click(b[0], b[1]);
      await sleep(450);
    };
    await draw("Trend line", [170, 450], [700, 220]);
    await draw("Rectangle", [260, 300], [520, 410]);
    await draw("Fibonacci retracement", [560, 240], [720, 400]);
    await sleep(700);
  },

  async indicators(page) {
    await page.locator(".ck-picker").waitFor({ state: "visible", timeout: 20000 });
    await sleep(900);
    for (const label of ["Bollinger Bands", "Simple Moving Average", "MACD", "Stochastic Oscillator"]) {
      await page.getByText(label, { exact: true }).click();
      await sleep(750);
    }
  },

  async measurement(page) {
    await page.locator(".ck-toolbar").waitFor({ state: "visible", timeout: 20000 });
    await sleep(700);
    await page.keyboard.down("Shift");
    await page.mouse.move(190, 450);
    await page.mouse.down();
    for (const [x, y] of [[300, 400], [430, 330], [560, 280], [680, 240]]) {
      await page.mouse.move(x, y, { steps: 6 });
      await sleep(280);
    }
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await sleep(900);
  },

  async replay(page) {
    const play = page.locator('button[title="Play"]');
    await play.waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('button[title="Play"]');
      return b && !b.disabled;
    }, { timeout: 20000 });
    // Jump to session open, then play forward.
    await page.getByText("Open", { exact: true }).click().catch(() => {});
    await page.selectOption(".ck-replay-speed", "16").catch(() => {});
    await sleep(300);
    await play.click();
    await sleep(2400);
  },
};

async function capture(browser, scene) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const url = DEMO ? BASE + DEMO + "/" : BASE;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(600);
  const frames = [];
  const stop = startCapture(page, frames);
  await SCENES[scene](page);
  await sleep(300);
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

const scenes = SCENE === "all" ? ["drawing", "indicators", "measurement", "replay"] : [SCENE];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const s of scenes) await capture(browser, s);
} finally {
  await browser.close();
}
