/**
 * Plugin system. A plugin is a small object with lifecycle hooks that receives
 * a {@link PluginContext} granting access to the chart, its main series, the
 * shared event bus, and the resolved theme. Drawing, indicators, and
 * measurement are all implemented as (or behind) this contract, and consumers
 * register their own the same way.
 */

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { EventBus } from "../events/eventBus";
import type { Bar, ChartTheme } from "../core/types";

/** Events emitted on the chart-wide bus. Plugins both read and contribute. */
export interface ChartEventMap {
  /** Full data set was (re)applied. */
  data: { bars: readonly Bar[] };
  /** Active theme changed. */
  theme: { theme: ChartTheme };
  /** Visible time range changed (epoch ms). */
  rangeChange: { from: number; to: number } | null;
  /** Crosshair moved. `null` when it leaves the pane. */
  crosshairMove: { ts: number; price: number } | null;
  /** A drawing was created / edited / removed. */
  drawingChange: { count: number };
  /** Replay cursor advanced. */
  replayCursor: { ts: number };
  /** A point marker was caught (epoch ms) or cleared (`null`). */
  pointMarker: number | null;
  [key: string]: unknown;
}

export interface PluginContext {
  chart: IChartApi;
  /** The main price series (candlestick by default). */
  series: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;
  bus: EventBus<ChartEventMap>;
  theme: ChartTheme;
  /** Current bars at the active interval. */
  getBars(): readonly Bar[];
}

export interface ChartPlugin {
  /** Unique id (used for dedupe + teardown). */
  readonly id: string;
  /** Called once after the chart + series exist. */
  init(ctx: PluginContext): void;
  /** Optional: theme changed; re-read colors. */
  onThemeChange?(theme: ChartTheme): void;
  /** Optional: full data set changed; recompute. */
  onData?(bars: readonly Bar[]): void;
  /** Optional: a single live/replay bar was appended or updated. Lets a plugin
   *  react to streaming ticks without a full `onData` recompute. */
  onBar?(bar: Bar, bars: readonly Bar[]): void;
  /** Release all resources (series, primitives, subscriptions). */
  destroy(): void;
}

/** Factory form so a plugin can take construction-time options. */
export type ChartPluginFactory<O = void> = (options: O) => ChartPlugin;
