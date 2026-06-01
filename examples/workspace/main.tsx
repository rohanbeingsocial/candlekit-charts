import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartView,
  DrawingToolbar,
  IndicatorPicker,
  MeasurementOverlay,
  ReplayControls,
  IndicatorController,
  createBuiltinRegistry,
  createReplayController,
  resample,
  toBars,
  type Bar,
  type RawBar,
  type SeriesType,
  type ChartViewApi,
  type ReplayController,
  type ReplayDataSource,
} from "@candlekit/charts/react";
import "@candlekit/charts/styles.css";
import { generateBars } from "@candlekit/charts";

const SYMBOL = "DEMO";
const INTERVAL = "1m";
// Stable empty array — the chart's data is driven by the replay controller, not
// the `data` prop. An inline `[]` would re-fire ChartView's setData and wipe it.
const NO_DATA: RawBar[] = [];

/** One synthetic intraday session + a day-addressable replay source over it. */
function buildSession() {
  const start = Date.UTC(2024, 0, 2, 9, 30);
  const bars: Bar[] = toBars(generateBars(375, 100, start));
  const date = new Date(start).toISOString().slice(0, 10);
  const end = bars[bars.length - 1].ts;
  const source: ReplayDataSource = {
    async fetchDay(_s, _i, d) {
      return d === date ? bars : [];
    },
    async listDatesBefore() {
      return [];
    },
    async listDatesAfter() {
      return [];
    },
  };
  return { source, date, start, end };
}

const SERIES: { id: SeriesType; label: string }[] = [
  { id: "candlestick", label: "Candles" },
  { id: "bar", label: "OHLC" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

const TIMEFRAMES: { minutes: number; label: string }[] = [
  { minutes: 1, label: "1m" },
  { minutes: 5, label: "5m" },
  { minutes: 15, label: "15m" },
  { minutes: 60, label: "1h" },
];

// Fake-UTC ts → wall clock (matches the chart's IST-as-UTC convention).
const fmtClock = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

function App() {
  const { source, date, start, end } = useMemo(buildSession, []);
  const [seriesType, setSeriesType] = useState<SeriesType>("candlestick");
  const [tf, setTf] = useState(1);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [replay, setReplay] = useState<ReplayController | null>(null);

  const apiRef = useRef<ChartViewApi | null>(null);
  const rcRef = useRef<ReplayController | null>(null);
  const tfRef = useRef(tf);
  tfRef.current = tf;

  // Built-in MIT indicator catalog, two on by default to show overlay + pane.
  const indicators = useMemo(() => {
    const ctl = new IndicatorController(createBuiltinRegistry());
    ctl.add("EMA", { length: 21 });
    ctl.add("RSI", { length: 14 });
    return ctl;
  }, []);

  // Stable options — an inline object would re-init the drawing plugin every
  // render (and refire onReady). See ChartView's `drawing` prop note.
  const drawingOpts = useMemo(() => ({ storageKey: "candlekit:workspace:drawings" }), []);

  // Push bars up to the replay cursor (resampled to the active TF) into the chart.
  const renderBars = useCallback(() => {
    const rc = rcRef.current;
    const api = apiRef.current;
    if (!rc || !api || rc.getState().status !== "ready") return;
    const raw = rc.getBarsUpToCursor(SYMBOL, INTERVAL);
    const minutes = tfRef.current;
    const bars = minutes > 1 ? resample(raw as readonly RawBar[], minutes) : raw;
    api.controller.setData(bars);
  }, []);

  const onReady = (api: ChartViewApi) => {
    apiRef.current = api;
    const rc = createReplayController();
    rcRef.current = rc;
    rc.subscribe((s) => {
      if (s.status === "ready") renderBars();
    });
    rc.load({
      id: `demo-${date}`,
      series: [{ symbol: SYMBOL, interval: INTERVAL }],
      start,
      end,
      source,
    }).then(() => {
      rc.seek(end); // start with the full session shown; scrub back to replay
      setReplay(rc);
    });
  };

  useEffect(() => () => replay?.unload(), [replay]);
  // Re-render bars when the timeframe changes.
  useEffect(() => {
    renderBars();
  }, [tf, renderBars]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  };

  const jumps = useMemo(() => {
    const out: { label: string; ts: number }[] = [{ label: "Open", ts: start }];
    for (let h = 1; h <= 5; h++) {
      const ts = start + h * 60 * 60_000;
      if (ts < end) out.push({ label: `+${h}h`, ts });
    }
    out.push({ label: "Close", ts: end });
    return out;
  }, [start, end]);

  return (
    <div style={S.app}>
      <header style={S.toolbar}>
        <span style={S.brand}>
          candlekit<span style={{ color: "var(--app-muted)" }}>/</span>charts
        </span>
        <Group label="Series">
          {SERIES.map((s) => (
            <Btn key={s.id} active={seriesType === s.id} onClick={() => setSeriesType(s.id)}>
              {s.label}
            </Btn>
          ))}
        </Group>
        <Group label="TF">
          {TIMEFRAMES.map((t) => (
            <Btn key={t.minutes} active={tf === t.minutes} onClick={() => setTf(t.minutes)}>
              {t.label}
            </Btn>
          ))}
        </Group>
        <button style={{ ...S.btn, marginLeft: "auto" }} onClick={toggleTheme}>
          {theme === "dark" ? "☀ Light" : "🌙 Dark"}
        </button>
      </header>

      <div style={S.body}>
        <main style={S.chartWrap}>
          <ChartView
            data={NO_DATA}
            seriesType={seriesType}
            theme={theme}
            drawing={drawingOpts}
            measurement
            indicators={indicators}
            onReady={onReady}
          >
            <DrawingToolbar />
            <IndicatorPicker />
            <MeasurementOverlay />
          </ChartView>
        </main>

        <aside style={S.aside}>
          {replay && (
            <ReplayControls controller={replay} formatTime={fmtClock} jumps={jumps} />
          )}
          <div style={S.help}>
            <p style={S.helpHead}>Try it</p>
            <ul style={S.helpList}>
              <li>Pick a drawing tool (left), click two points.</li>
              <li>Toggle indicators (right) — overlays + panes.</li>
              <li><b>Shift-drag</b> the chart to measure (shows %).</li>
              <li>Scrub / play the replay to step through the session.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={S.group}>
      <span style={S.groupLabel}>{label}</span>
      <div style={{ display: "flex", gap: 4 }}>{children}</div>
    </div>
  );
}

function Btn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={active ? { ...S.btn, ...S.btnActive } : S.btn}>
      {children}
    </button>
  );
}

const S: Record<string, CSSProperties> = {
  app: { display: "flex", flexDirection: "column", height: "100%" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "8px 12px",
    borderBottom: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    flexWrap: "wrap",
  },
  brand: { fontWeight: 700, fontSize: 14 },
  group: { display: "flex", alignItems: "center", gap: 6 },
  groupLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--app-muted)" },
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
  btnActive: { background: "var(--app-fg)", color: "var(--app-bg)", borderColor: "var(--app-fg)" },
  body: { display: "flex", flex: 1, minHeight: 0 },
  chartWrap: { position: "relative", flex: 1, minWidth: 0 },
  aside: {
    width: 280,
    flexShrink: 0,
    borderLeft: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    overflowY: "auto",
  },
  help: { fontSize: 12, color: "var(--app-muted)" },
  helpHead: { margin: "0 0 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" },
  helpList: { margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4, lineHeight: 1.4 },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
