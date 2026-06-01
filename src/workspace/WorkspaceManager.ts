/**
 * WorkspaceManager — public orchestration layer.
 *
 * Consumers interact with this object directly:
 *   const workspace = createWorkspace({ storage: localStorage });
 *   workspace.registerPanel({ kind: "chart", component: ChartPanel, ... });
 *   workspace.saveLayout("morning");
 *
 * The React / FlexLayout adapter registers itself as the active "layout driver"
 * so imperative calls (addPanel, removePanel, resetLayout) can mutate the live
 * FlexLayout tree.
 */

import type {
  CreateWorkspaceOptions,
  LayoutName,
  LayoutPersistence,
  LayoutTreeBlob,
  PanelConfig,
  PanelInstance,
  WorkspaceId,
  WorkspaceLayout,
  WorkspaceLayoutSummary,
  WorkspaceManager,
} from "./types";
import { PanelRegistryImpl } from "./PanelRegistry";
import { buildDefaultLayout } from "./DefaultLayouts";

const SCHEMA_VERSION = 1;

export class WorkspaceManagerImpl implements WorkspaceManager {
  readonly id: WorkspaceId;
  readonly registry = new PanelRegistryImpl();
  private storage: LayoutPersistence;
  private current: WorkspaceLayout;
  private subscribers = new Set<(layout: WorkspaceLayout) => void>();

  /** Internal bridge: the React adapter registers its tree mutators here. */
  private driver: {
    getTree: () => LayoutTreeBlob;
    setTree: (tree: LayoutTreeBlob) => void;
    addPanel: (kind: string, config?: PanelConfig, title?: string) => string | null;
    removePanel: (id: string) => void;
  } | null = null;

  constructor(opts: CreateWorkspaceOptions = {}) {
    this.id = opts.id ?? "default";
    this.storage = opts.storage ?? new InMemoryPersistence();
    const now = new Date().toISOString();
    this.current = {
      version: SCHEMA_VERSION,
      id: this.id,
      name: "default",
      createdAt: now,
      updatedAt: now,
      tree: opts.initialLayout ?? buildDefaultLayout(),
      panels: {},
    };
  }

  // ── Driver registration (called by React adapter on mount) ─────────────────

  /** @internal — called by the React/FlexLayout adapter. */
  _registerDriver(driver: NonNullable<WorkspaceManagerImpl["driver"]>): () => void {
    this.driver = driver;
    // Hydrate the adapter with the current tree.
    driver.setTree(this.current.tree);
    return () => {
      this.driver = null;
    };
  }

  /** @internal — called by the React adapter whenever the tree changes. */
  _onTreeChanged(tree: LayoutTreeBlob, panels: Record<string, PanelInstance>): void {
    this.current = { ...this.current, tree, panels, updatedAt: new Date().toISOString() };
    this.notify();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  registerPanel<T extends PanelConfig>(def: {
    kind: string;
    component: unknown;
    defaultConfig: () => T;
    displayName?: string;
    configVersion?: number;
  }): void {
    this.registry.register(def as never);
  }

  async saveLayout(name: LayoutName): Promise<void> {
    const tree = this.driver?.getTree() ?? this.current.tree;
    const now = new Date().toISOString();
    const payload: WorkspaceLayout = {
      version: SCHEMA_VERSION,
      id: this.id,
      name,
      createdAt: this.current.createdAt,
      updatedAt: now,
      tree,
      panels: this.current.panels,
    };
    await this.storage.save(payload);
  }

  async loadLayout(name: LayoutName): Promise<void> {
    const all = await this.storage.list();
    const match = all.find((l) => l.name === name);
    if (!match) return;
    const layout = await this.storage.get(match.id);
    if (!layout) return;
    this.current = layout;
    this.driver?.setTree(layout.tree);
    this.notify();
  }

  exportLayout(): unknown {
    return {
      version: SCHEMA_VERSION,
      id: this.id,
      name: this.current.name,
      createdAt: this.current.createdAt,
      updatedAt: new Date().toISOString(),
      tree: this.driver?.getTree() ?? this.current.tree,
      panels: this.current.panels,
    };
  }

  importLayout(blob: unknown): void {
    const parsed = blob as WorkspaceLayout;
    if (!parsed || typeof parsed !== "object") return;
    this.current = {
      ...parsed,
      id: this.id,
      updatedAt: new Date().toISOString(),
    };
    this.driver?.setTree(this.current.tree);
    this.notify();
  }

  async listLayouts(): Promise<readonly WorkspaceLayoutSummary[]> {
    return this.storage.list();
  }

  async deleteLayout(name: LayoutName): Promise<void> {
    const all = await this.storage.list();
    const match = all.find((l) => l.name === name);
    if (match) await this.storage.delete(match.id);
  }

  resetLayout(): void {
    const tree = buildDefaultLayout();
    this.current = {
      ...this.current,
      tree,
      panels: {},
      updatedAt: new Date().toISOString(),
    };
    this.driver?.setTree(tree);
    this.notify();
  }

  addPanel(kind: string, config?: PanelConfig, title?: string): string | null {
    return this.driver?.addPanel(kind, config, title) ?? null;
  }

  removePanel(id: string): void {
    this.driver?.removePanel(id);
  }

  subscribe(cb: (layout: WorkspaceLayout) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private notify(): void {
    for (const cb of this.subscribers) {
      try {
        cb(this.current);
      } catch {
        /* swallow */
      }
    }
  }
}

/** In-memory fallback when no persistence is provided. */
class InMemoryPersistence implements LayoutPersistence {
  private store = new Map<string, WorkspaceLayout>();

  async get(id: string): Promise<WorkspaceLayout | null> {
    return this.store.get(id) ?? null;
  }

  async save(layout: WorkspaceLayout): Promise<void> {
    this.store.set(layout.id, layout);
  }

  async list(): Promise<readonly WorkspaceLayoutSummary[]> {
    return Array.from(this.store.values()).map((l) => ({
      id: l.id,
      name: l.name,
      updatedAt: l.updatedAt,
    }));
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

/** Convenience factory. */
export function createWorkspace(options?: CreateWorkspaceOptions): WorkspaceManager {
  return new WorkspaceManagerImpl(options);
}
