/**
 * Runtime smoke test for the OPTIONAL integrations. Kept out of `npm test`
 * (which globs tests/**) because it requires the optional deps installed.
 * Run explicitly:  npm run test:smoke
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createOakscriptRegistry } from "../src/indicators/oakscript";
import type { IndicatorBar } from "../src/indicators/types";

const require = createRequire(import.meta.url);

/**
 * Resolve a package's ESM (`module`-field) entry — what real bundlers
 * (Vite/webpack) load and where the named exports live. Node's bare
 * `import(pkg)` resolves `main` (a UMD bundle here) which exposes no named
 * exports, so we import the ESM file directly to mirror the consumer path.
 */
async function importEsm(pkg: string): Promise<Record<string, unknown>> {
  const pjPath = require.resolve(`${pkg}/package.json`);
  const pj = require(`${pkg}/package.json`);
  const entry = resolve(dirname(pjPath), pj.module ?? pj.main);
  return (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
}

const bars: IndicatorBar[] = Array.from({ length: 60 }, (_, i) => ({
  time: 1_700_000_000 + i * 60,
  open: 100 + Math.sin(i / 5),
  high: 101 + Math.sin(i / 5),
  low: 99 + Math.sin(i / 5),
  close: 100 + Math.sin(i / 5),
  volume: 10 + i,
}));

describe("runtime: oakscript indicator catalog", () => {
  it("loads, exposes common indicators, and computes plots", async () => {
    const reg = await createOakscriptRegistry();
    const names = reg.list().map((d) => d.name);
    expect(names.length).toBeGreaterThan(0);

    const hay = names.join(",").toLowerCase();
    for (const want of ["sma", "ema", "rsi"]) expect(hay).toContain(want);

    const sma = reg.list().find((d) => d.name.toLowerCase().includes("sma"));
    expect(sma).toBeTruthy();
    const res = sma!.calculate(bars, sma!.defaultInputs);
    const firstPlot = Object.values(res.plots)[0] ?? [];
    expect(firstPlot.length).toBeGreaterThan(0);
    expect(Number.isFinite(firstPlot[firstPlot.length - 1].value)).toBe(true);
  });
});

describe("runtime: line-tools drawing core (ESM bundler path)", () => {
  it("core exposes createLineToolsPlugin", async () => {
    // `core` is the runtime our adapter calls (`createLineToolsPlugin(chart,
    // series)`). The tool-class packages (lines/rectangle/circle/fib) import
    // named exports FROM core, which Node can only honor through a bundler that
    // respects the ESM `module` field — so their standalone resolution + the
    // full drawing wiring is validated by the `examples/drawing` Vite build
    // (which code-splits all five line-tools packages), not here.
    const core = await importEsm("lightweight-charts-line-tools-core");
    expect(typeof core.createLineToolsPlugin).toBe("function");
    // Spot-check a few primitives core must export for the tool packages.
    for (const sym of ["AnchorPoint", "BaseLineTool", "InteractionManager"]) {
      expect(core[sym], `${sym} missing from core ESM`).toBeTruthy();
    }
  });
});
