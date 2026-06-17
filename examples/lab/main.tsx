/**
 * Lab demo: Sketch Search + Echoes ("market déjà vu").
 *
 * One chart wired with both lab plugins:
 *   - Toggle **Sketch** (top-left), drag a freehand shape across the chart, and
 *     release — the historical windows whose price shape looks most like your
 *     stroke light up as bands.
 *   - In the **Echoes** panel (top-right) hit *Scan* — the windows most similar
 *     to the most recent price action band, and the median of what happened
 *     *after* them projects forward from the last bar (dashed line).
 *
 * Data is a synthetic random walk (`generateBars`) — no network.
 */

import { StrictMode, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { ChartView, SketchSearchButton, EchoesPanel, generateBars, type RawBar } from "@getcandlekit/charts/react";
import "@getcandlekit/charts/styles.css";

type Theme = "light" | "dark";

function App() {
  const data = useMemo<RawBar[]>(() => generateBars(1500, 120), []);
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <div style={S.app}>
      <header style={S.header}>
        <span style={S.brand}>
          candlekit<span style={{ color: "var(--app-muted)" }}>/</span>lab
        </span>
        <span style={{ color: "var(--app-muted)", fontSize: 12 }}>Sketch Search + Echoes</span>
        <span style={S.hint}>Toggle Sketch → drag a shape on the chart · or hit Scan for déjà-vu echoes</span>
        <button style={S.btn} onClick={toggle}>
          {theme === "dark" ? "☀ Light" : "🌙 Dark"}
        </button>
      </header>

      <div style={S.body}>
        <ChartView data={data} theme={theme} sketch echoes={{ windowLen: 40, horizon: 40, k: 8 }}>
          <div style={S.toolbar}>
            <SketchSearchButton />
          </div>
          <div style={S.panel}>
            <EchoesPanel defaultWindowLen={40} defaultHorizon={40} />
          </div>
        </ChartView>
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
  hint: { marginLeft: "auto", color: "var(--app-muted)", fontSize: 11 },
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
  body: { position: "relative", flex: 1, minHeight: 0 },
  toolbar: { position: "absolute", top: 8, left: 8, zIndex: 5 },
  panel: { position: "absolute", top: 8, right: 8, zIndex: 5 },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
