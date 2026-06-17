/**
 * Lab demo: Sketch Search + Echoes ("market déjà vu").
 *
 * Chart on the left, Echoes panel as a side column on the right (so it never
 * covers the price axis or candles). Sketch lives as a small toggle over the
 * chart — arm it, drag a freehand shape, release to find look-alikes.
 *
 *   - Echoes: hit *Scan* → similar past windows band on the chart, and the
 *     median of what happened next projects forward from the last bar.
 *   - Sketch: toggle, drag a shape, release → matching windows highlight.
 *
 * The Echoes panel sits outside <ChartView>, so it reads the chart API lifted
 * via `onReady` and re-provided through <ChartContext>. Data is a synthetic
 * random walk (`generateBars`) — no network.
 */

import { StrictMode, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartView,
  SketchSearchButton,
  EchoesPanel,
  ChartContext,
  generateBars,
  type RawBar,
  type ChartViewApi,
} from "@getcandlekit/charts/react";
import "@getcandlekit/charts/styles.css";

type Theme = "light" | "dark";

function App() {
  const data = useMemo<RawBar[]>(() => generateBars(1500, 120), []);
  // Memoized so <ChartView> doesn't re-create the lab plugins every render.
  const echoesOpts = useMemo(() => ({ windowLen: 40, horizon: 40, k: 8 }), []);
  const sketchOpts = useMemo(() => ({ queryLength: 48 }), []);
  const [api, setApi] = useState<ChartViewApi | null>(null);

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
        <span style={S.tag}>experimental</span>
        <span style={S.hint}>
          Toggle <strong style={S.kbd}>Sketch</strong> &amp; drag a shape · or{" "}
          <strong style={S.kbd}>Scan</strong> for déjà-vu echoes
        </span>
        <button style={S.btn} onClick={toggle}>
          {theme === "dark" ? "☀ Light" : "🌙 Dark"}
        </button>
      </header>

      <div style={S.body}>
        <div style={S.chartWrap}>
          <ChartView data={data} theme={theme} sketch={sketchOpts} echoes={echoesOpts} onReady={setApi}>
            <div style={S.toolbar}>
              <SketchSearchButton />
            </div>
          </ChartView>
        </div>

        {api && (
          <ChartContext.Provider value={api}>
            <aside style={S.side}>
              <EchoesPanel defaultWindowLen={40} defaultHorizon={40} style={S.panel} />
            </aside>
          </ChartContext.Provider>
        )}
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
  brand: { fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" },
  tag: {
    padding: "2px 8px",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--app-muted)",
    border: "1px solid var(--app-border)",
    borderRadius: 999,
  },
  hint: { marginLeft: "auto", color: "var(--app-muted)", fontSize: 11 },
  kbd: { color: "var(--app-fg)", fontWeight: 600 },
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
  body: { display: "flex", flex: 1, minHeight: 0 },
  chartWrap: { position: "relative", flex: 1, minWidth: 0 },
  toolbar: { position: "absolute", top: 10, left: 10, zIndex: 5 },
  side: {
    width: 300,
    flexShrink: 0,
    padding: 14,
    overflowY: "auto",
    borderLeft: "1px solid var(--app-border)",
    background: "var(--app-panel)",
  },
  // In the side column the card is flush — drop its own chrome so it reads as a panel.
  panel: { width: "100%", border: "none", background: "transparent", boxShadow: "none", padding: 0, backdropFilter: "none" },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
