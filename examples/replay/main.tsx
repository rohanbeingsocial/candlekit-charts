import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ChartView,
  ReplayControls,
  createReplayController,
  toBars,
  type ChartViewApi,
  type ReplayController,
  type ReplayDataSource,
  type Bar,
} from "@candlekit/charts/react";
import "@candlekit/charts/styles.css";
import { generateBars } from "@candlekit/charts";

/** Build 3 intraday days of synthetic 1m bars and a day-addressable source. */
function buildSource() {
  const days = ["2024-01-02", "2024-01-03", "2024-01-04"];
  const byDate: Record<string, Bar[]> = {};
  let price = 100;
  for (const d of days) {
    const [y, m, dd] = d.split("-").map(Number);
    const bars = toBars(generateBars(375, price, Date.UTC(y, m - 1, dd, 9, 30)));
    byDate[d] = bars;
    price = bars[bars.length - 1].close;
  }
  const source: ReplayDataSource = {
    async fetchDay(_s, _i, date) {
      return byDate[date] ?? [];
    },
    async listDatesBefore(_s, _i, date, n) {
      const i = days.indexOf(date);
      return days.slice(Math.max(0, i - n), i).reverse();
    },
    async listDatesAfter(_s, _i, date, n) {
      const i = days.indexOf(date);
      return i < 0 ? [] : days.slice(i + 1, i + 1 + n);
    },
  };
  return { source, days };
}

function App() {
  const { source, days } = useMemo(buildSource, []);
  const [replay, setReplay] = useState<ReplayController | null>(null);
  const apiRef = useRef<ChartViewApi | null>(null);

  const onReady = (api: ChartViewApi) => {
    apiRef.current = api;
    const rc = createReplayController();
    // Redraw history up to the cursor on every state change.
    rc.subscribe((s) => {
      if (s.status === "ready") api.controller.setData(rc.getBarsUpToCursor("DEMO", "1m"));
    });
    rc.load({
      id: "demo",
      series: [{ symbol: "DEMO", interval: "1m" }],
      start: Date.UTC(2024, 0, 2, 9, 30),
      end: Date.UTC(2024, 0, 4, 15, 30),
      source,
    }).then(() => setReplay(rc));
  };

  useEffect(() => () => replay?.unload(), [replay]);

  return (
    <div style={{ padding: 12 }}>
      <p>Deterministic replay over {days.length} synthetic days. Play, step, change speed, or seek.</p>
      {replay && (
        <div style={{ marginBottom: 8, maxWidth: 560 }}>
          <ReplayControls controller={replay} />
        </div>
      )}
      <div style={{ height: "70vh" }}>
        <ChartView data={[]} seriesType="candlestick" theme="dark" autoFit={false} onReady={onReady} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
