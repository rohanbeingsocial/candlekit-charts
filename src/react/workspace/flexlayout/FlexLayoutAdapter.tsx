/**
 * FlexLayoutAdapter — wraps flexlayout-react behind the workspace abstraction.
 *
 * This component:
 *   - mounts a FlexLayout `<Layout>`
 *   - registers itself as the "driver" on the WorkspaceManager
 *   - maps TabNode → registered panel components
 *   - forwards tree changes back to the manager
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Actions,
  DockLocation,
  Layout,
  type IJsonModel,
  type ILayoutApi,
  type Model,
  type Node as FlexNode,
  type TabNode,
} from "flexlayout-react";
import type { PanelDefinition, PanelInstance, WorkspaceManager } from "../../../workspace";
import { createModelFromJson, modelToJson } from "./ModelFactory";

export interface FlexLayoutAdapterProps {
  workspace: WorkspaceManager;
  className?: string;
  /** Optional toolbar content rendered above the layout. */
  toolbar?: ReactNode;
  /** Hide the built-in toolbar. */
  hideToolbar?: boolean;
  /** Called when the adapter has mounted and registered its driver. */
  onReady?: () => void;
}

export function FlexLayoutAdapter({
  workspace,
  className,
  toolbar,
  hideToolbar,
  onReady,
}: FlexLayoutAdapterProps) {
  return (
    <WorkspaceProvider workspace={workspace}>
      <FlexLayoutAdapterInner
        className={className}
        toolbar={toolbar}
        hideToolbar={hideToolbar}
        onReady={onReady}
      />
    </WorkspaceProvider>
  );
}

// ── Context ──────────────────────────────────────────────────────────────────

import { createContext, useContext } from "react";

const WorkspaceContext = createContext<WorkspaceManager | null>(null);

function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: WorkspaceManager;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceManager {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used inside <WorkspaceProvider>");
  return ctx;
}

// ── Inner component ──────────────────────────────────────────────────────────

function FlexLayoutAdapterInner({
  className,
  toolbar,
  hideToolbar,
  onReady,
}: {
  className?: string;
  toolbar?: ReactNode;
  hideToolbar?: boolean;
  onReady?: () => void;
}) {
  const workspace = useWorkspaceContext();
  const [model, setModel] = useState<Model | null>(null);
  const layoutRef = useRef<ILayoutApi | null>(null);
  const modelRef = useRef<Model | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => { modelRef.current = model; }, [model]);

  const factory = useMemo(() => makePanelFactory(workspace), [workspace]);

  const hydrate = useCallback((json: IJsonModel) => {
    try {
      setModel(createModelFromJson(json));
    } catch (e) {
      console.warn("FlexLayoutAdapter: failed to hydrate layout", e);
      // Fallback to empty model so the UI doesn't crash.
      setModel(createModelFromJson({ global: {}, layout: { type: "row", children: [] } }));
    }
  }, []);

  // Register driver + initial hydrate.
  useEffect(() => {
    let cancelled = false;

    const unregister = (workspace as unknown as { _registerDriver: (d: unknown) => () => void })._registerDriver({
      getTree: () => (modelRef.current ? modelToJson(modelRef.current) : {}),
      setTree: (tree: unknown) => {
        if (!cancelled) hydrate(tree as IJsonModel);
      },
      addPanel: (kind: string, config?: Record<string, unknown>, title?: string) => {
        return addPanelToModel(workspace, modelRef.current, kind, config, title);
      },
      removePanel: (id: string) => {
        if (!modelRef.current) return;
        modelRef.current.doAction(Actions.deleteTab(id));
      },
    });

    // Hydrate from manager's current tree.
    const tree = (workspace as unknown as { current: { tree: unknown } }).current?.tree;
    if (tree) hydrate(tree as IJsonModel);

    onReady?.();

    return () => {
      cancelled = true;
      unregister();
    };
  }, [workspace, hydrate, onReady]);

  // Debounced autosave.
  const onModelChange = useMemo(() => (m: Model) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const panels = extractPanelsFromModel(m);
      (workspace as unknown as { _onTreeChanged: (tree: unknown, panels: unknown) => void })._onTreeChanged(
        modelToJson(m),
        panels,
      );
    }, 400);
  }, [workspace]);

  if (!model) {
    return <div className={className} style={{ height: "100%" }} />;
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!hideToolbar && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderBottom: "1px solid var(--app-border)",
            background: "var(--app-panel)",
            fontSize: 12,
          }}
        >
          <AddPanelButton workspace={workspace} modelRef={modelRef} />
          <button
            type="button"
            onClick={() => workspace.resetLayout()}
            style={btnStyle}
          >
            Reset Layout
          </button>
          {toolbar && (
            <>
              <div style={{ width: 1, alignSelf: "stretch", background: "var(--app-border)", margin: "0 2px" }} />
              {toolbar}
            </>
          )}
          <span style={{ marginLeft: "auto", color: "var(--app-muted)" }}>
            Drag tabs · resize splitters · double-click header to maximize
          </span>
        </div>
      )}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <Layout
          ref={layoutRef}
          model={model}
          factory={factory}
          onModelChange={onModelChange}
          realtimeResize
        />
      </div>
    </div>
  );
}

// ── Panel factory ────────────────────────────────────────────────────────────

function makePanelFactory(workspace: WorkspaceManager) {
  return (node: TabNode) => <PanelHostMount node={node} workspace={workspace} />;
}

function PanelHostMount({ node, workspace }: { node: TabNode; workspace: WorkspaceManager }) {
  const panelId = node.getId();
  const kind = node.getComponent() ?? "unknown";
  const def = workspace.registry.get(kind);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const raw = node.getConfig() as PanelInstance | undefined;
  const instance: PanelInstance =
    raw && raw.kind === kind
      ? raw
      : {
          id: panelId,
          kind,
          title: node.getName() ?? kind,
          config: def?.defaultConfig() ?? {},
        };

  const updateConfig = useCallback(
    (next: Partial<Record<string, unknown>>) => {
      const current = (node.getConfig() as PanelInstance | undefined) ?? {
        id: panelId,
        kind,
        title: node.getName() ?? kind,
        config: def?.defaultConfig() ?? {},
      };
      const merged: PanelInstance = {
        ...current,
        config: { ...(current.config as object), ...(next as object) },
      };
      const model = node.getModel();
      model.doAction(Actions.updateNodeAttributes(panelId, { config: merged } as never));
      bump();
    },
    [node, panelId, kind, def],
  );

  if (!def) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--app-muted)" }}>
        Unknown panel kind: <code>{kind}</code>
      </div>
    );
  }

  const Component = def.component as React.ComponentType<{
    instance: PanelInstance;
    updateConfig: (next: Partial<Record<string, unknown>>) => void;
  }>;

  return <Component instance={instance} updateConfig={updateConfig} />;
}

// ── Add panel button ─────────────────────────────────────────────────────────

function AddPanelButton({
  workspace,
  modelRef,
}: {
  workspace: WorkspaceManager;
  modelRef: React.MutableRefObject<Model | null>;
}) {
  const [open, setOpen] = useState(false);
  const defs = workspace.registry.list();

  const handleAdd = useCallback(
    (def: PanelDefinition) => {
      addPanelToModel(workspace, modelRef.current, def.kind);
      setOpen(false);
    },
    [workspace, modelRef],
  );

  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(!open)} style={btnStyle}>
        + Add Panel
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            background: "var(--app-panel)",
            color: "var(--app-fg)",
            border: "1px solid var(--app-border)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            minWidth: 180,
            zIndex: 1000,
            overflow: "hidden",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {defs.length === 0 && (
            <div style={{ padding: "8px 12px", color: "var(--app-muted)" }}>
              No panels registered
            </div>
          )}
          {defs.map((d) => (
            <button
              key={d.kind}
              type="button"
              onClick={() => handleAdd(d)}
              style={menuItemStyle}
            >
              {d.displayName ?? d.kind}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addPanelToModel(
  workspace: WorkspaceManager,
  model: Model | null,
  kind: string,
  configOverride?: Record<string, unknown>,
  titleOverride?: string,
): string | null {
  if (!model) return null;
  const def = workspace.registry.get(kind);
  if (!def) {
    console.warn(`Workspace: no panel registered for kind "${kind}"`);
    return null;
  }
  const id = `panel-${kind}-${Date.now().toString(36)}`;
  const baseConfig = def.defaultConfig();
  const config = configOverride ? { ...baseConfig, ...configOverride } : baseConfig;
  const title = titleOverride ?? def.displayName ?? kind;
  const instance: PanelInstance = { id, kind, title, config };

  let targetId = model.getActiveTabset()?.getId();
  if (!targetId) {
    let found: string | null = null;
    model.visitNodes((node: FlexNode) => {
      if (!found && node.getType() === "tabset") found = node.getId();
    });
    targetId = found ?? undefined;
  }
  if (!targetId) return null;

  model.doAction(
    Actions.addNode(
      { id, type: "tab", name: title, component: kind, config: instance },
      targetId,
      DockLocation.CENTER,
      -1,
      true,
    ),
  );
  return id;
}

function extractPanelsFromModel(model: Model): Record<string, PanelInstance> {
  const panels: Record<string, PanelInstance> = {};
  model.visitNodes((node: FlexNode) => {
    if (node.getType() === "tab") {
      const tab = node as TabNode;
      const cfg = tab.getConfig() as PanelInstance | undefined;
      if (cfg && cfg.id) {
        panels[cfg.id] = cfg;
      }
    }
  });
  return panels;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  background: "var(--app-bg)",
  color: "var(--app-fg)",
  border: "1px solid var(--app-border)",
  borderRadius: 4,
  padding: "3px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  color: "inherit",
  border: "none",
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
};
