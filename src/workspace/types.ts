/**
 * Workspace system contracts.
 *
 * Framework-agnostic types for panel registration, layout persistence, and
 * workspace orchestration. The React / FlexLayout bindings are a thin layer
 * over these contracts.
 */

// ── Panel registration ───────────────────────────────────────────────────────

/** Opaque panel config — workspace never interprets this. */
export type PanelConfig = object;

export interface PanelInstance<TConfig extends PanelConfig = PanelConfig> {
  /** Stable id (matches the layout node id). */
  id: string;
  /** Registered panel kind. */
  kind: string;
  /** Tab title. */
  title: string;
  /** Panel-specific persisted config. */
  config: TConfig;
  /** Optional sync group membership. */
  groupId?: string;
}

export interface PanelDefinition<TConfig extends PanelConfig = PanelConfig> {
  kind: string;
  /** React component rendered inside the tab (bound by the React layer). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  /** Initial config for new instances. */
  defaultConfig: () => TConfig;
  /** Human-readable name for picker UIs. */
  displayName?: string;
  /** Schema version for future migrations. */
  configVersion?: number;
}

export interface PanelRegistry {
  register<T extends PanelConfig>(def: PanelDefinition<T>): void;
  get(kind: string): PanelDefinition | undefined;
  list(): readonly PanelDefinition[];
}

// ── Layout ───────────────────────────────────────────────────────────────────

export type WorkspaceId = string;
export type LayoutName = string;
export type LayoutSchemaVersion = 1;

/** Opaque blob — only the layout engine interprets it. */
export type LayoutTreeBlob = unknown;

export interface WorkspaceLayout {
  version: LayoutSchemaVersion;
  id: WorkspaceId;
  name: LayoutName;
  createdAt: string;
  updatedAt: string;
  tree: LayoutTreeBlob;
  /** Panel runtime config keyed by panel id. */
  panels: Record<string, PanelInstance>;
}

export interface WorkspaceLayoutSummary {
  id: WorkspaceId;
  name: LayoutName;
  updatedAt: string;
}

export interface LayoutPersistence {
  get(id: WorkspaceId): Promise<WorkspaceLayout | null>;
  save(layout: WorkspaceLayout): Promise<void>;
  list(): Promise<readonly WorkspaceLayoutSummary[]>;
  delete(id: WorkspaceId): Promise<void>;
}

// ── Workspace manager ────────────────────────────────────────────────────────

export interface CreateWorkspaceOptions {
  id?: WorkspaceId;
  /** Storage adapter. Defaults to in-memory. */
  storage?: LayoutPersistence;
  /** Initial layout tree (overrides default). */
  initialLayout?: LayoutTreeBlob;
}

export interface WorkspaceManager {
  readonly id: WorkspaceId;
  readonly registry: PanelRegistry;

  registerPanel<T extends PanelConfig>(def: PanelDefinition<T>): void;

  /** Snapshot the current live layout. */
  saveLayout(name: LayoutName): Promise<void>;
  /** Restore a named layout. */
  loadLayout(name: LayoutName): Promise<void>;
  /** Export current layout as a plain JSON blob. */
  exportLayout(): unknown;
  /** Import a layout from a JSON blob. */
  importLayout(blob: unknown): void;
  /** List saved layouts. */
  listLayouts(): Promise<readonly WorkspaceLayoutSummary[]>;
  /** Delete a saved layout. */
  deleteLayout(name: LayoutName): Promise<void>;

  /** Reset to the default layout. */
  resetLayout(): void;

  /** Add a panel instance to the active tabset. */
  addPanel(kind: string, config?: PanelConfig, title?: string): string | null;
  /** Remove a panel by id. */
  removePanel(id: string): void;

  /** Subscribe to layout changes (debounced). */
  subscribe(cb: (layout: WorkspaceLayout) => void): () => void;
}
