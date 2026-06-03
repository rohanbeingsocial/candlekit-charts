/**
 * Canonical demo: Drawing tools + a simple flex layout.
 *
 * Deliberately minimal — no workspace manager, no docking, no persistence beyond
 * each chart's own drawing localStorage. Multi-chart layout is just nested
 * <SplitPane>s (resizable). Theme is one `data-theme` attribute that themes the
 * chrome, the .ck-* overlays, and every chart canvas at once.
 */

import { StrictMode, memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { ChartView, DrawingToolbar, SplitPane, generateBars, type RawBar } from "@getcandlekit/charts/react";
import "@getcandlekit/charts/styles.css";

type Theme = "light" | "dark";

/** One resizable chart cell. memo'd so a theme toggle re-themes it without
 *  regenerating data, and a sibling pane resize never re-renders it. */
const ChartCell = memo(function ChartCell({ id, theme, seed }: { id: string; theme: Theme; seed: number }) {
  const data = useMemo<RawBar[]>(() => generateBars(600, 90 + seed * 25), [seed]);
  const drawing = useMemo(() => ({ storageKey: `candlekit:drawing-demo:${id}` }), [id]);
  return (
    <ChartView data={data} drawing={drawing} measurement theme={theme}>
      <DrawingToolbar />
    </ChartView>
  );
});

function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark",
  );

  // The attribute is the single source of truth — drives chrome vars (index.html),
  // .ck-* overlays (styles.css), and is mirrored into each chart's `theme` prop.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <div style={S.app}>
      <header style={S.header}>
        <span style={S.brand}>
          candlekit<span style={{ color: "var(--app-muted)" }}>/</span>charts
        </span>
        <span style={{ color: "var(--app-muted)", fontSize: 12 }}>Drawing tools + flex layout</span>
        <span style={S.hint}>Drag the gutters to resize · pick a tool to draw · Shift-drag to measure</span>
        <button style={S.btn} onClick={toggle}>
          {theme === "dark" ? "☀ Light" : "🌙 Dark"}
        </button>
      </header>

      <div style={S.body}>
        <SplitPane direction="horizontal" initial={0.5}>
          <ChartCell id="a" theme={theme} seed={0} />
          <SplitPane direction="vertical" initial={0.5}>
            <ChartCell id="b" theme={theme} seed={1} />
            <ChartCell id="c" theme={theme} seed={2} />
          </SplitPane>
        </SplitPane>
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
  body: { flex: 1, minHeight: 0 },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
