/**
 * Drawing data model + mutation API + events. Pure (no DOM, no chart): holds the
 * list of drawings, the in-progress draft, the current selection, the active
 * tool, lock state, and the default style. The {@link DrawingController} drives
 * it from pointer events; the {@link DrawingPrimitive} renders from it.
 *
 * `export()` / `import()` serialize to JSON for persistence. Drawing anchors are
 * stored in data space (lightweight-charts time + price) so they stay
 * positionally correct across pan/zoom and reloads.
 */

import { DEFAULT_STYLE, TOOL_POINTS, type Drawing, type DrawingStyle, type DrawingToolId, type DrawingPoint } from "./types";

let counter = 0;
const newId = () => `dw_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export class DrawingEngine {
  private drawings: Drawing[] = [];
  private draft: Drawing | null = null;
  private selectedId: string | null = null;
  private activeTool: DrawingToolId | null = null;
  private locked = false;
  private style: DrawingStyle = { ...DEFAULT_STYLE };
  private listeners = new Set<() => void>();
  private destroyed = false;

  // ── Tool selection ───────────────────────────────────────────────────────────

  startTool(tool: DrawingToolId): void {
    if (this.destroyed) return;
    this.activeTool = tool;
    this.draft = null;
    this.selectedId = null;
    this.emit();
  }

  stopTool(): void {
    this.activeTool = null;
    this.draft = null;
    this.emit();
  }

  getActiveTool(): DrawingToolId | null {
    return this.activeTool;
  }

  pointsNeeded(tool: DrawingToolId): number {
    return TOOL_POINTS[tool] ?? 2;
  }

  // ── Draft (in-progress placement) ──────────────────────────────────────────────

  beginDraft(tool: DrawingToolId, p: DrawingPoint): void {
    this.draft = { id: newId(), tool, points: [p, p], style: { ...this.style } };
    this.emit();
  }

  updateDraftEnd(p: DrawingPoint): void {
    if (!this.draft) return;
    this.draft.points[this.draft.points.length - 1] = p;
    this.emit();
  }

  getDraft(): Drawing | null {
    return this.draft;
  }

  /** Commit the draft (or a complete one-point drawing) as a real drawing. */
  commit(drawing: Drawing): void {
    this.drawings.push(drawing);
    this.draft = null;
    this.activeTool = null;
    this.selectedId = drawing.id;
    this.emit();
  }

  cancelDraft(): void {
    if (!this.draft && !this.activeTool) return;
    this.draft = null;
    this.activeTool = null;
    this.emit();
  }

  // ── Mutation ─────────────────────────────────────────────────────────────────

  getDrawings(): readonly Drawing[] {
    return this.drawings;
  }

  getById(id: string): Drawing | undefined {
    return this.drawings.find((d) => d.id === id);
  }

  setPoints(id: string, points: DrawingPoint[]): void {
    const d = this.getById(id);
    if (!d) return;
    d.points = points;
    this.emit();
  }

  setStyle(id: string, patch: Partial<DrawingStyle>): void {
    const d = this.getById(id);
    if (!d) return;
    d.style = { ...d.style, ...patch };
    this.emit();
  }

  /** Default style applied to new drawings. */
  setDefaultStyle(patch: Partial<DrawingStyle>): void {
    this.style = { ...this.style, ...patch };
  }

  getDefaultStyle(): DrawingStyle {
    return { ...this.style };
  }

  // ── Selection ──────────────────────────────────────────────────────────────────

  select(id: string | null): void {
    this.selectedId = id;
    this.emit();
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  removeSelected(): void {
    if (!this.selectedId) return;
    this.drawings = this.drawings.filter((d) => d.id !== this.selectedId);
    this.selectedId = null;
    this.emit();
  }

  remove(id: string): void {
    this.drawings = this.drawings.filter((d) => d.id !== id);
    if (this.selectedId === id) this.selectedId = null;
    this.emit();
  }

  removeAll(): void {
    this.drawings = [];
    this.draft = null;
    this.selectedId = null;
    this.emit();
  }

  // ── Lock ───────────────────────────────────────────────────────────────────────

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) this.selectedId = null;
    this.emit();
  }

  isLocked(): boolean {
    return this.locked;
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  export(): string {
    return JSON.stringify(this.drawings);
  }

  import(json: string): void {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        this.drawings = parsed.filter(
          (d): d is Drawing => d && typeof d.id === "string" && Array.isArray(d.points),
        );
        this.emit();
      }
    } catch {
      /* corrupt */
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  /** Fires after every change (create/move/style/delete/select). */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch {
        /* */
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  newDrawingId = newId;
}
