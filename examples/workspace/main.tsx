import { StrictMode, useCallback, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  createWorkspace,
  LocalStoragePersistence,
  FlexLayoutAdapter,
  ChartPanel,
  WorkspaceProvider,
  setWorkspaceIndicatorRegistry,
  useLayout,
} from "@candlekit/charts/react/workspace";
import { createFullIndicatorRegistry } from "@candlekit/charts/indicators-tv";
import "@candlekit/charts/styles.css";
import "flexlayout-react/style/dark.css";

// ── The canonical workspace ──────────────────────────────────────────────────
// One unified workspace: every pane is a full chart pane (chart + drawing tools
// + indicators + measurement + replay, all attached to the pane). FlexLayout is
// the splitter — it just lets more chart panes exist (split, resize, close, add,
// sync). There is no separate "FlexLayout demo", no standalone indicator/tool/
// replay windows. Everything revolves around the chart pane.

// Every ChartPanel's Indicators dropdown lists the full 400+ MIT catalog
// (candlekit built-ins + lightweight-charts-indicators) before any pane mounts.
setWorkspaceIndicatorRegistry(createFullIndicatorRegistry());

const workspace = createWorkspace({
  id: "candlekit-workspace",
  storage: new LocalStoragePersistence(),
});

// The chart pane is the only registered panel kind — FlexLayout adds/splits
// chart panes; the pane itself owns drawing, indicators, measurement, replay.
workspace.registerPanel({
  kind: "chart",
  displayName: "Chart",
  component: ChartPanel,
  defaultConfig: () => ({ symbol: "DEMO", interval: "1m", seriesType: "candlestick" }),
});

/** Save / load / export / import layouts — handed to the adapter toolbar. */
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
          <span style={{ color: "var(--app-muted)", fontSize: 12 }}>Workspace</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--app-muted)", fontSize: 11 }}>
              Split charts · draw · indicators · ▶ Replay per pane
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
  body: { flex: 1, minHeight: 0 },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
