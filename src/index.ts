/**
 * @getcandlekit/charts — framework-agnostic entry.
 *
 * Everything here is free of React. The only external runtime dependency is
 * `lightweight-charts` (peer). Drawing tools and indicators are original,
 * self-contained implementations — no third-party drawing/indicator runtimes.
 * The React bindings live at `@getcandlekit/charts/react`.
 */

// ── Core ───────────────────────────────────────────────────────────────────────
export * from "./core/types";
export * from "./core/data";
export * from "./core/time";
export * from "./core/theme";

// ── Events + plugin system ──────────────────────────────────────────────────────
export * from "./events/eventBus";
export * from "./plugins/types";

// ── Browser-window helpers (multi-window / detached-panel correctness) ──────────
export * from "./dom/ownerWindow";

// ── Chart ───────────────────────────────────────────────────────────────────────
export * from "./chart/ChartController";
export * from "./chart/liveEdgeFollower";

// ── Data source contracts ───────────────────────────────────────────────────────
export * from "./data-source/types";

// ── Live feed / broker data layer (transport-agnostic adapters) ─────────────────
export * from "./feed/types";
export * from "./feed/aggregator";
export * from "./feed/reconnect";
export * from "./feed/MockFeed";

// ── ML / AI overlay contracts ───────────────────────────────────────────────────
export * from "./ml/types";

// ── Lab (pattern-similarity analytics: Echoes + Sketch Search) ──────────────────
// Pure math + chart-coupled plugins (primitives, sketch capture, déjà-vu scan).
export * from "./lab/types";
export * from "./lab/similarity";
export * from "./lab/MatchHighlightPrimitive";
export * from "./lab/SketchStrokePrimitive";
export * from "./lab/SketchSearchController";
export * from "./lab/EchoesController";

// ── Drawing (original engine rendered on lightweight-charts primitives) ─────────
export * from "./drawing/types";
export * from "./drawing/icons";
export * from "./drawing/geometry";
export * from "./drawing/DrawingEngine";
export * from "./drawing/DrawingPrimitive";
export * from "./drawing/DrawingController";
export * from "./drawing/coordinateMapping";
export * from "./drawing/persistence";

// ── Measurement ─────────────────────────────────────────────────────────────────
export * from "./measurement/types";
export * from "./measurement/RulerPrimitive";
export * from "./measurement/ChartCoordinateUtils";
export * from "./measurement/MeasurementController";
export * from "./measurement/PointMarkerPrimitive";
export * from "./measurement/PointMarkerController";
export * from "./measurement/CrosshairMarkerPrimitive";

// ── Indicators (registry + controller + built-in catalog; pluggable) ────────────
export * from "./indicators/types";
export * from "./indicators/registry";
export * from "./indicators/builtin";
export * from "./indicators/IndicatorController";
export * from "./indicators/paneKeyRegistry";

// ── Replay ──────────────────────────────────────────────────────────────────────
export * from "./replay/types";
export * from "./replay/ReplayController";

// ── Sync ────────────────────────────────────────────────────────────────────────
export * from "./sync/types";
export * from "./sync/SyncEngine";
