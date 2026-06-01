import { StrictMode, useState, type CSSProperties } from "react";
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
} from "@candlekit/charts/react/workspace";
import "flexlayout-react/style/dark.css";

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
  defaultConfig: () => ({ symbols: ["DEMO"] }),
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
    <div style={S.app}>
      <header style={S.header}>
        <span style={S.brand}>
          candlekit<span style={{ color: "var(--app-muted)" }}>/</span>charts
        </span>
        <span style={{ color: "var(--app-muted)", fontSize: 12 }}>Workspace Demo</span>
        <button style={{ ...S.btn, marginLeft: "auto" }} onClick={toggleTheme}>
          {theme === "dark" ? "☀ Light" : "🌙 Dark"}
        </button>
      </header>
      <div style={S.body}>
        <FlexLayoutAdapter workspace={workspace} />
      </div>
    </div>
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
  body: { flex: 1, minHeight: 0 },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
