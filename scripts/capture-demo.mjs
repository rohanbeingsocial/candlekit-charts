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
// `??` (not `||`) so an explicit empty DEMO="" targets the site root — a local
// vite dev server serves the workspace app at "/", not "/workspace/". When unset,
// each scene falls back to its own demo (see SCENE_DEMO): most run against the
// dense `workspace`, but `replay` runs against the focused single-chart `replay`
// example so the streaming bars aren't hidden behind workspace indicators/panes.
const DEMO_OVERRIDE = env.DEMO; // undefined ⇒ per-scene default below
const SCENE_DEMO = {
  workspace: "workspace",
  drawing: "workspace",
  indicators: "workspace",
  measurement: "workspace",
  replay: "replay",
  // Sketch + Echoes live only in the focused `lab` example (not the workspace).
  lab: "lab",
};
const WIDTH = Number(env.WIDTH || 1180);
const HEIGHT = Number(env.HEIGHT || 680);
const DELAY_MS = Number(env.DELAY_MS || 140);
const MAXFRAMES = Number(env.MAXFRAMES || 52);
// Palette size. Fewer colours = smaller GIF; the dense multi-pane `workspace`
// scene (two extra charts + volume bars) needs this knob to stay under ~2MB.
const COLORS = Math.max(2, Math.min(256, Number(env.COLORS || 256)));
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
  // Headline multi-pane scene: the default two synced charts, then add a third
  // chart from "+ Add Panel", resize the split, drop in the dedicated Replay
  // pane (also from the menu) and play the session forward.
  async workspace(page) {
    await page.locator(".ck-toolbar").first().waitFor({ state: "visible", timeout: 20000 });
    await sleep(800);

    const addPanel = page.locator("button", { hasText: "Add Panel" }).first();
    const openMenuItem = async (name) => {
      await addPanel.click();
      await sleep(320);
      await page.getByRole("button", { name, exact: true }).click();
    };

    // 1) Add a third chart.
    await openMenuItem("Chart");
    await sleep(950);

    // 2) Resize: drag the splitter between the two columns to widen the left one.
    // (flexlayout names the column-divider by its handle axis: *_horz.)
    const splitter = page.locator(".flexlayout__splitter.flexlayout__splitter_horz").first();
    const box = await splitter.boundingBox().catch(() => null);
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 150, cy, { steps: 16 });
      await sleep(120);
      await page.mouse.move(cx + 80, cy, { steps: 10 });
      await page.mouse.up();
    }
    await sleep(800);

    // 3) Add the replay transport pane.
    await openMenuItem("Replay");
    await sleep(900);

    // 4) Load a shared session — every chart pane then follows the cursor.
    await page.getByRole("button", { name: "Load session" }).click();
    await sleep(1100);

    // 5) Play forward; the visible chart panes stream up to the cursor.
    const play = page.locator('button[title="Play"]').last();
    await play.waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(() => {
      const bs = [...document.querySelectorAll('button[title="Play"]')];
      const b = bs[bs.length - 1];
      return b && !b.disabled;
    }, { timeout: 20000 });
    await page.selectOption(".ck-replay-speed", "16").catch(() => {});
    await sleep(250);
    await play.click();
    await sleep(2400);
  },

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

  // Lab: déjà-vu Echoes + freehand Sketch Search, against the focused `lab` demo.
  async lab(page) {
    await page.locator('button[aria-label="Sketch search"]').waitFor({ state: "visible", timeout: 20000 });
    await sleep(700);

    // 1) Echoes — scan for historical look-alikes of the recent window; bands +
    //    a dashed median projection appear off the last bar.
    await page.locator(".ck-lab-run").click();
    await sleep(1600);

    // 2) Sketch — arm, draw a freehand wave across the chart, release to search.
    await page.locator('button[aria-label="Sketch search"]').click();
    await sleep(300);
    await page.mouse.move(320, 430);
    await page.mouse.down();
    for (const [x, y] of [[400, 360], [480, 410], [560, 300], [640, 360], [740, 250]]) {
      await page.mouse.move(x, y, { steps: 8 });
      await sleep(140);
    }
    await page.mouse.up();
    await sleep(1500);
  },

  // Scenes may be a plain fn (whole run is recorded) OR `{ prep, act }` where
  // `prep` runs BEFORE the frame recorder starts — use it for setup that would
  // otherwise show as a frozen intro. The replay scene needs this: waiting for
  // the controller to load + arming the speed is dead air, and only `act` (the
  // forward play) should be in the GIF.
  replay: {
    async prep(page) {
      const play = page.locator('button[title="Play"]');
      await play.waitFor({ state: "visible", timeout: 20000 });
      await page.waitForFunction(() => {
        const b = document.querySelector('button[title="Play"]');
        return b && !b.disabled;
      }, { timeout: 20000 });
      // Speed 8 ⇒ one bar every 1000/8 = 125ms (BASE_TICK_MS/speed), which is
      // ~1 bar per captured frame at DELAY_MS=140 → a clean bar-by-bar march.
      // Speed 16 (the old value) advanced ~2.2 bars/frame, so bars teleported.
      await page.selectOption(".ck-replay-speed", "8").catch(() => {});
      await sleep(300);
    },
    async act(page) {
      const play = page.locator('button[title="Play"]');
      await play.click();
      // ~5.4s at 125ms/bar ≈ 43 bars stream in — fills the recorded window
      // with visible candle formation rather than a short burst.
      await sleep(5400);
    },
  },
};

async function capture(browser, scene) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const demo = DEMO_OVERRIDE ?? SCENE_DEMO[scene] ?? "workspace";
  const url = demo ? BASE + demo + "/" : BASE;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(600);

  // A scene is either a plain fn (recorded in full) or `{ prep, act }` where
  // `prep` runs un-recorded first (see SCENES.replay).
  const def = SCENES[scene];
  const prep = typeof def === "object" ? def.prep : null;
  const act = typeof def === "function" ? def : def.act;
  if (prep) await prep(page);

  const frames = [];
  const stop = startCapture(page, frames);
  await act(page);
  await sleep(300);
  await stop();
  await page.close();

  // Debug: DUMP_FRAMES=1 writes the middle raw frame as PNG to eyeball that the
  // scene actually shows what we want (e.g. visible replay bars). Not committed.
  if (env.DUMP_FRAMES && frames.length) {
    writeFileSync(resolve(outDir, `${scene}-mid.png`), frames[Math.floor(frames.length / 2)]);
  }

  const gif = GIFEncoder();
  for (const buf of frames) {
    const { width, height, data } = PNG.sync.read(buf);
    const palette = quantize(data, COLORS, { format: "rgba4444" });
    const index = applyPalette(data, palette, "rgba4444");
    gif.writeFrame(index, width, height, { palette, delay: DELAY_MS });
  }
  gif.finish();
  const out = resolve(outDir, `${scene}.gif`);
  writeFileSync(out, Buffer.from(gif.bytes()));
  console.log(`✅ ${out} — ${frames.length} frames ${WIDTH}x${HEIGHT}`);
}

const scenes = SCENE === "all" ? ["workspace", "drawing", "indicators", "measurement", "replay", "lab"] : [SCENE];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const s of scenes) await capture(browser, s);
} finally {
  await browser.close();
}
