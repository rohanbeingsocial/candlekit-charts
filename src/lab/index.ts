/**
 * Lab — experimental pattern-similarity analytics.
 *
 * Pure math (no chart):
 *   - similarity / Echoes : find historical look-alikes of a price window
 *   - Sketch Search       : match a freehand stroke against history
 *
 * Chart-coupled plugins + primitives (lightweight-charts peer):
 *   - SketchSearchController : draw a shape, search, highlight matches
 *   - EchoesController       : déjà-vu scan with bands + forward projection
 */
export * from "./types";
export * from "./similarity";
export * from "./MatchHighlightPrimitive";
export * from "./SketchStrokePrimitive";
export * from "./SketchSearchController";
export * from "./EchoesController";
