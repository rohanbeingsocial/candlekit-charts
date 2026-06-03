import { StrictMode, useState, useCallback, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  createWorkspace,
  LocalStoragePersistence,
  FlexLayoutAdapter,
  ChartPanel,
  WatchlistPanel,
  IndicatorPanel,
  ToolPanel,
  DataPanel,
  WorkspaceProvider,
  setWorkspaceIndicatorRegistry,
  useLayout,
} from "@candlekit/charts/react/workspace";
import { createFullIndicatorRegistry } from "@candlekit/charts/indicators-tv";
import "flexlayout-react/style/dark.css";

// Make every ChartPanel's Indicators dropdown list the full 400+ MIT catalog
// (candlekit built-ins + lightweight-charts-indicators) before any panel mounts.
setWorkspaceIndicatorRegistry(createFullIndicatorRegistry());

const workspace = createWorkspace({
  id: "demo",
  storage: new LocalStoragePersistence(),
});

workspace.registerPanel({
  kind: "chart",
  displayName: "Chart",
  component: ChartPanel,
  defaultConfig: () => ({ symbol: "DEMO", interval: "1m", seriesType: "candlestick" }),
});

workspace.registerPanel({
  kind: "watchlist",
  displayName: "Watchlist",
  component: WatchlistPanel,
  defaultConfig: () => ({ symbols: ["DEMO", "BTC", "ETH", "SOL"] }),
});

workspace.registerPanel({
  kind: "indicators",
  displayName: "Indicators",
  component: IndicatorPanel,
  defaultConfig: () => ({ active: [] }),
});

workspace.registerPanel({
  kind: "tools",
  displayName: "Tools",
  component: ToolPanel,
  defaultConfig: () => ({ activeTool: "cursor" }),
});

workspace.registerPanel({
  kind: "data",
  displayName: "Data",
  component: DataPanel,
  defaultConfig: () => ({ count: 100 }),
});

// Layout save/load/export/import, passed into the adapter's built-in toolbar via
// the `toolbar` extra slot — mirrors how the main site puts its saved-layout
// switcher in WorkspaceShell.toolbarExtra. Add Panel + Reset come from the
// adapter's own toolbar (same component as the production workspace shell).
function LayoutControls() {
  const { saveLayout, loadLayout, exportLayout, importLayout } = useLayout();
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    saveLayout("default");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [saveLayout]);

  const handleLoad = useCallback(() => {
    loadLayout("default");
  }, [loadLayout]);

  const handleExport = useCallback(() => {
    const json = JSON.stringify(exportLayout(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace-layout.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportLayout]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const json = ev.target?.result as string;
        if (json) importLayout(json);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importLayout]);

  return (
    <>
      <button style={S.toolbarBtn} onClick={handleSave}>{saved ? "✓ Saved" : "Save Layout"}</button>
      <button style={S.toolbarBtn} onClick={handleLoad}>Load Layout</button>
      <button style={S.toolbarBtn} onClick={handleExport}>Export JSON</button>
      <button style={S.toolbarBtn} onClick={handleImport}>Import JSON</button>
    </>
  );
}

function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  };

  return (
    <WorkspaceProvider workspace={workspace}>
      <div style={S.app}>
        <header style={S.header}>
          <span style={S.brand}>
            candlekit<span style={{ color: "var(--app-muted)" }}>/</span>charts
          </span>
          <span style={{ color: "var(--app-muted)", fontSize: 12 }}>FlexLayout Workspace Demo</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--app-muted)", fontSize: 11 }}>
              Drag tabs to rearrange · Right-click tabs for options
            </span>
            <button style={S.btn} onClick={toggleTheme}>
              {theme === "dark" ? "☀ Light" : "🌙 Dark"}
            </button>
          </span>
        </header>
        <div style={S.body}>
          <FlexLayoutAdapter workspace={workspace} toolbar={<LayoutControls />} />
        </div>
      </div>
    </WorkspaceProvider>
  );
}

const S: Record<string, CSSProperties> = {
  app: { display: "flex", flexDirection: "column", height: "100%" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 12px",
    borderBottom: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    flexShrink: 0,
  },
  brand: { fontWeight: 700, fontSize: 14 },
  btn: {
    height: 26,
    padding: "0 10px",
    fontSize: 12,
    fontFamily: "inherit",
    color: "var(--app-fg)",
    background: "transparent",
    border: "1px solid var(--app-border)",
    borderRadius: 5,
    cursor: "pointer",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderBottom: "1px solid var(--app-border)",
    background: "var(--app-bg)",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  toolbarLabel: {
    fontSize: 11,
    color: "var(--app-muted)",
    marginRight: 4,
  },
  toolbarBtn: {
    height: 24,
    padding: "0 10px",
    fontSize: 11,
    fontFamily: "inherit",
    color: "var(--app-fg)",
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    cursor: "pointer",
  },
  divider: {
    width: 1,
    height: 16,
    background: "var(--app-border)",
    margin: "0 4px",
  },
  body: { flex: 1, minHeight: 0 },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
