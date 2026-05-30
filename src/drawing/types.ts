/**
 * Drawing framework contracts.
 *
 * The drawing engine is decoupled from any concrete line-tools runtime via a
 * structural interface ({@link LineToolsRuntime}). The bundled adapter wires the
 * MPL-2.0 `lightweight-charts-line-tools-*` packages, but any runtime exposing
 * this surface can be plugged in — that is the extensible drawing framework.
 */

/** Built-in tool ids the bundled adapter registers. Strings stay open-ended so
 *  custom runtimes can add their own. */
export type DrawingToolId =
  | "TrendLine"
  | "Ray"
  | "ExtendedLine"
  | "HorizontalLine"
  | "HorizontalRay"
  | "VerticalLine"
  | "Arrow"
  | "CrossLine"
  | "Rectangle"
  | "Circle"
  | "FibRetracement"
  | "Brush"
  | "Text"
  | (string & {});

export interface DrawingAfterEditParams {
  selectedLineTool?: unknown;
}
export interface DrawingClickParams {
  selectedLineTool?: unknown;
}

/**
 * Structural surface the {@link DrawingEngine} drives. Mirrors the
 * `ILineToolsPlugin` shape exposed by the line-tools-core runtime, but declared
 * here so the core bundle never imports the optional package.
 */
export interface LineToolsRuntime {
  registerLineTool(name: string, ctor: unknown): void;
  addLineTool(name: string): void;
  stopDrawing?(): void;
  removeSelectedLineTools(): void;
  removeAllLineTools(): void;
  getSelectedLineTools(): string;
  applyLineToolOptions(toolData: unknown): boolean;
  setCrossHairXY(x: number | null, y: number | null, visible: boolean): void;
  setMagnetThreshold(pixels: number): void;
  setLocked(locked: boolean): void;
  isLocked(): boolean;
  exportLineTools(): string;
  importLineTools(json: string): void;
  subscribeLineToolsAfterEdit(cb: (p: DrawingAfterEditParams) => void): void;
  unsubscribeLineToolsAfterEdit(cb: (p: DrawingAfterEditParams) => void): void;
  subscribeLineToolsSingleClick(cb: (p: DrawingClickParams) => void): void;
  unsubscribeLineToolsSingleClick(cb: (p: DrawingClickParams) => void): void;
  subscribeLineToolsDoubleClick(cb: (p: DrawingClickParams) => void): void;
  unsubscribeLineToolsDoubleClick(cb: (p: DrawingClickParams) => void): void;
}
