/**
 * Optional adapter: wires the MPL-2.0 `lightweight-charts-line-tools-*` family
 * into a ready-to-use {@link DrawingPlugin}. This is the **only** module that
 * touches those packages, and it loads them lazily via dynamic `import()` so:
 *
 *   1. the core bundle never references them,
 *   2. `tsc`/build succeed when they are not installed (CI `--no-optional`),
 *   3. drawing code is only fetched when a consumer actually enables drawing.
 *
 * Install the optional deps to use this (they are git-hosted, not on npm):
 *
 *   npm i github:difurious/lightweight-charts-line-tools-core \
 *         github:difurious/lightweight-charts-line-tools-lines \
 *         github:difurious/lightweight-charts-line-tools-rectangle \
 *         github:difurious/lightweight-charts-line-tools-circle \
 *         github:difurious/lightweight-charts-line-tools-fib-retracement
 *
 * Bundled under: @candlekit/charts/drawing-linetools
 */

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { DrawingPlugin } from "./DrawingPlugin";
import type { KVStore } from "./persistence";
import type { DrawingToolId, LineToolsRuntime } from "./types";

/** Tools registered by default, in toolbar order. */
export const DEFAULT_LINE_TOOLS: DrawingToolId[] = [
  "TrendLine",
  "Ray",
  "ExtendedLine",
  "HorizontalLine",
  "HorizontalRay",
  "VerticalLine",
  "Arrow",
  "CrossLine",
  "Rectangle",
  "Circle",
  "FibRetracement",
];

export interface LineToolsDrawingOptions {
  magnetThreshold?: number;
  storageKey?: string | null;
  kv?: KVStore;
  /** Restrict to a subset of {@link DEFAULT_LINE_TOOLS}. */
  tools?: DrawingToolId[];
}

type Mod = Record<string, unknown>;

/**
 * Build a {@link DrawingPlugin} backed by the line-tools runtime. Async because
 * it lazy-loads the optional packages. `await` it, then pass the result to
 * `controller.use(plugin)`.
 *
 * The dynamic imports use **literal specifiers** so consumer bundlers
 * (Vite/webpack/rollup) resolve and code-split the optional packages into an
 * async chunk. Ambient fallback declarations (`src/optional-deps.d.ts`) keep
 * `tsc` happy when the packages are not installed.
 */
export async function createLineToolsDrawingPlugin(
  opts: LineToolsDrawingOptions = {},
): Promise<DrawingPlugin> {
  const [core, lines, rect, circle, fib] = (await Promise.all([
    import("lightweight-charts-line-tools-core"),
    import("lightweight-charts-line-tools-lines"),
    import("lightweight-charts-line-tools-rectangle"),
    import("lightweight-charts-line-tools-circle"),
    import("lightweight-charts-line-tools-fib-retracement"),
  ])) as unknown as [Mod, Mod, Mod, Mod, Mod];

  const createLineToolsPlugin = core.createLineToolsPlugin as (
    chart: IChartApi,
    series: unknown,
  ) => LineToolsRuntime;

  const ctorById: Record<string, unknown> = {
    TrendLine: lines.LineToolTrendLine,
    Ray: lines.LineToolRay,
    ExtendedLine: lines.LineToolExtendedLine,
    HorizontalLine: lines.LineToolHorizontalLine,
    HorizontalRay: lines.LineToolHorizontalRay,
    VerticalLine: lines.LineToolVerticalLine,
    Arrow: lines.LineToolArrow,
    CrossLine: lines.LineToolCrossLine,
    Rectangle: rect.LineToolRectangle,
    Circle: circle.LineToolCircle,
    FibRetracement: fib.LineToolFibRetracement,
  };

  const wanted = opts.tools ?? DEFAULT_LINE_TOOLS;
  const tools: Array<[string, unknown]> = wanted
    .filter((id) => ctorById[id])
    .map((id) => [id, ctorById[id]]);

  return new DrawingPlugin({
    createRuntime: (chart: IChartApi, series: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">) =>
      createLineToolsPlugin(chart, series),
    tools,
    magnetThreshold: opts.magnetThreshold ?? 0,
    storageKey: opts.storageKey ?? null,
    kv: opts.kv,
  });
}
