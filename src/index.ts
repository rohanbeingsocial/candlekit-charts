/**
 * @candlekit/charts — framework-agnostic entry.
 *
 * Everything here is free of React and of the optional drawing/indicator
 * runtimes. Subpath entries layer those on:
 *   @candlekit/charts/react                React bindings
 *   @candlekit/charts/drawing-linetools    MPL line-tools drawing adapter
 *   @candlekit/charts/indicators-oakscript bundled indicator set
 */

// ── Core ───────────────────────────────────────────────────────────────────────
export * from "./core/types";
export * from "./core/data";
export * from "./core/time";
export * from "./core/theme";

// ── Events + plugin system ──────────────────────────────────────────────────────
export * from "./events/eventBus";
export * from "./plugins/types";

// ── Chart ───────────────────────────────────────────────────────────────────────
export * from "./chart/ChartController";

// ── Data source contracts ───────────────────────────────────────────────────────
export * from "./data-source/types";

// ── Drawing (engine + plugin; the line-tools runtime is injected) ───────────────
export * from "./drawing/types";
export * from "./drawing/DrawingEngine";
export * from "./drawing/DrawingPlugin";
export * from "./drawing/persistence";

// ── Measurement ─────────────────────────────────────────────────────────────────
export * from "./measurement/types";
export * from "./measurement/RulerPrimitive";
export * from "./measurement/ChartCoordinateUtils";
export * from "./measurement/MeasurementController";

// ── Indicators (registry + controller; definitions are pluggable) ───────────────
export * from "./indicators/types";
export * from "./indicators/registry";
export * from "./indicators/IndicatorController";

// ── Replay ──────────────────────────────────────────────────────────────────────
export * from "./replay/types";
export * from "./replay/ReplayController";

// ── Sync ────────────────────────────────────────────────────────────────────────
export * from "./sync/types";
export * from "./sync/SyncEngine";
