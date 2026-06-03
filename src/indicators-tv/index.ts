/**
 * @candlekit/charts/indicators-tv — optional bulk indicator catalog.
 *
 * Registers the full `lightweight-charts-indicators` set (400+ indicators) into
 * a candlekit {@link IndicatorRegistry} via {@link defFromRaw}. Both that package
 * and its `oakscriptjs` peer are MIT — and they are **optional peer deps**, so
 * the core entry stays free of any third-party indicator runtime and ships
 * nothing extra unless a consumer imports from here.
 *
 * Usage:
 * ```ts
 * import { createFullIndicatorRegistry } from "@candlekit/charts/indicators-tv";
 * import { IndicatorController } from "@candlekit/charts";
 * const indicators = new IndicatorController(createFullIndicatorRegistry());
 * ```
 *
 * Install the peers: `npm i lightweight-charts-indicators oakscriptjs`.
 */

import * as TvIndicators from "lightweight-charts-indicators";
import { IndicatorRegistry, defFromRaw } from "../indicators/registry";
import { createBuiltinRegistry } from "../indicators/builtin";

/**
 * Adapt every indicator definition exported by `lightweight-charts-indicators`
 * into `registry`. Non-indicator exports are skipped. Returns the registry.
 */
export function registerTradingViewIndicators(
  registry: IndicatorRegistry = new IndicatorRegistry(),
): IndicatorRegistry {
  for (const [name, raw] of Object.entries(TvIndicators as Record<string, unknown>)) {
    const def = defFromRaw(name, raw);
    if (def) registry.register(def);
  }
  return registry;
}

/**
 * The full catalog with candlekit's own built-ins layered on top, so the curated
 * SMA/EMA/RSI/MACD/… win over same-named third-party entries while every extra
 * indicator remains available.
 */
export function createFullIndicatorRegistry(): IndicatorRegistry {
  const registry = registerTradingViewIndicators(new IndicatorRegistry());
  return createBuiltinRegistry(registry);
}

/** Count of indicators currently registered from the TradingView-style catalog. */
export function tradingViewIndicatorCount(): number {
  return registerTradingViewIndicators(new IndicatorRegistry()).list().length;
}
