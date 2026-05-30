/**
 * Drawing engine facade over a {@link LineToolsRuntime}. Provides a stable,
 * runtime-agnostic API for tool creation, selection, persistence, locking,
 * crosshair forwarding (for multi-chart sync), and edit events.
 *
 * Ported and decoupled from the original application's drawing engine: the only
 * change is that the concrete `lightweight-charts-line-tools-core` plugin type
 * is replaced by the structural {@link LineToolsRuntime} interface, so this file
 * has no hard dependency on the optional MPL packages.
 */

import type {
  DrawingAfterEditParams,
  DrawingClickParams,
  DrawingToolId,
  LineToolsRuntime,
} from "./types";

export class DrawingEngine {
  private destroyed = false;

  constructor(private readonly runtime: LineToolsRuntime) {}

  // ── Tool registration ────────────────────────────────────────────────────────

  registerTools(tools: Array<[string, unknown]>): void {
    for (const [name, ctor] of tools) this.runtime.registerLineTool(name, ctor);
  }

  // ── Drawing creation ───────────────────────────────────────────────────────────

  startTool(tool: DrawingToolId): void {
    if (this.destroyed) return;
    this.runtime.addLineTool(tool);
  }

  stopTool(): void {
    if (this.destroyed) return;
    this.runtime.stopDrawing?.();
  }

  // ── Selection & deletion ─────────────────────────────────────────────────────

  removeSelected(): void {
    if (this.destroyed) return;
    this.runtime.removeSelectedLineTools();
  }

  removeAll(): void {
    if (this.destroyed) return;
    this.runtime.removeAllLineTools();
  }

  getSelected(): string {
    if (this.destroyed) return "[]";
    return this.runtime.getSelectedLineTools();
  }

  /** Parse selected tools — empty array if none / destroyed / malformed. */
  getSelectedParsed<T = unknown>(): T[] {
    try {
      return JSON.parse(this.getSelected()) as T[];
    } catch {
      return [];
    }
  }

  /** Apply partial option overrides to a tool (pass a patched export object). */
  applyOptions(toolData: unknown): boolean {
    if (this.destroyed) return false;
    return this.runtime.applyLineToolOptions(toolData);
  }

  // ── Crosshair (multi-chart sync) ──────────────────────────────────────────────

  setCrosshairXY(x: number | null, y: number | null, visible: boolean): void {
    if (this.destroyed) return;
    this.runtime.setCrossHairXY(x, y, visible);
  }

  // ── Magnet snap ──────────────────────────────────────────────────────────────

  setMagnetThreshold(pixels: number): void {
    if (this.destroyed) return;
    this.runtime.setMagnetThreshold(pixels);
  }

  // ── Interaction lock ───────────────────────────────────────────────────────────

  setLocked(locked: boolean): void {
    if (this.destroyed) return;
    this.runtime.setLocked(locked);
  }

  isLocked(): boolean {
    if (this.destroyed) return false;
    return this.runtime.isLocked();
  }

  // ── Persistence ────────────────────────────────────────────────────────────────

  export(): string {
    if (this.destroyed) return "[]";
    return this.runtime.exportLineTools();
  }

  import(json: string): void {
    if (this.destroyed) return;
    this.runtime.importLineTools(json);
  }

  // ── Events ─────────────────────────────────────────────────────────────────────

  onAfterEdit(cb: (p: DrawingAfterEditParams) => void): () => void {
    this.runtime.subscribeLineToolsAfterEdit(cb);
    return () => this.runtime.unsubscribeLineToolsAfterEdit(cb);
  }

  onSingleClick(cb: (p: DrawingClickParams) => void): () => void {
    this.runtime.subscribeLineToolsSingleClick(cb);
    return () => this.runtime.unsubscribeLineToolsSingleClick(cb);
  }

  onDoubleClick(cb: (p: DrawingClickParams) => void): () => void {
    this.runtime.subscribeLineToolsDoubleClick(cb);
    return () => this.runtime.unsubscribeLineToolsDoubleClick(cb);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────────

  destroy(): void {
    this.destroyed = true;
  }
}
