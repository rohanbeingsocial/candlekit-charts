import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChartView } from "@getcandlekit/charts/react";
import type { SeriesType } from "@getcandlekit/charts";
import { generateBars } from "@getcandlekit/charts";

const TYPES: SeriesType[] = ["candlestick", "ohlc", "line", "area"];

function App() {
  const data = useMemo(() => generateBars(600), []);
  const [type, setType] = useState<SeriesType>("candlestick");
  const [tf, setTf] = useState(1);
  const [dark, setDark] = useState(true);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} disabled={t === type}>
            {t}
          </button>
        ))}
        {[1, 5, 15, 60].map((m) => (
          <button key={m} onClick={() => setTf(m)} disabled={m === tf}>
            {m}m
          </button>
        ))}
        <button onClick={() => setDark((d) => !d)}>{dark ? "🌙" : "☀️"}</button>
      </div>
      <div style={{ height: "70vh" }}>
        <ChartView data={data} seriesType={type} resampleMinutes={tf} theme={dark ? "dark" : "light"} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
