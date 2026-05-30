/**
 * Optional bundled indicator set: builds an {@link IndicatorRegistry} from
 * `lightweight-charts-indicators` (MIT, on npm) — SMA, EMA, WMA, VWAP, RSI,
 * MACD, Bollinger Bands, ATR, Stochastic, and the rest of that package's
 * catalog. Lazy-loaded so the core bundle stays free of the dependency.
 *
 * Install the optional deps:  npm i lightweight-charts-indicators oakscriptjs
 *
 * Bundled under: @candlekit/charts/indicators-oakscript
 */

import { IndicatorRegistry, defFromRaw } from "./registry";

/**
 * Create a registry populated with every compatible indicator exported by
 * `lightweight-charts-indicators`. Pass an existing registry to extend it.
 *
 * Uses a literal dynamic import so consumer bundlers code-split the optional
 * dependency; ambient fallback declarations keep `tsc` happy without it.
 */
export async function createOakscriptRegistry(into?: IndicatorRegistry): Promise<IndicatorRegistry> {
  const registry = into ?? new IndicatorRegistry();
  const all = (await import("lightweight-charts-indicators")) as unknown as Record<string, unknown>;
  for (const [name, raw] of Object.entries(all)) {
    const def = defFromRaw(name, raw);
    if (def) registry.register(def);
  }
  return registry;
}
