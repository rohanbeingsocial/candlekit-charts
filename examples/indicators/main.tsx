import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChartView, IndicatorPicker } from "@candlekit/charts/react";
import { IndicatorController } from "@candlekit/charts";
import { createOakscriptRegistry } from "@candlekit/charts/indicators-oakscript";
import "@candlekit/charts/styles.css";
import { generateBars } from "../shared/sampleData";

function App() {
  const data = useMemo(() => generateBars(600), []);
  const [indicators, setIndicators] = useState<IndicatorController | null>(null);

  useEffect(() => {
    let live = true;
    createOakscriptRegistry().then((registry) => {
      if (!live) return;
      const ctl = new IndicatorController(registry);
      ctl.add("EMA", { length: 21 }); // seed a couple
      ctl.add("RSI", { length: 14 });
      setIndicators(ctl);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <p>Toggle indicators in the panel (top-right). Overlays draw on price; oscillators get their own pane.</p>
      <div style={{ height: "75vh" }}>
        {indicators ? (
          <ChartView data={data} indicators={indicators} theme="dark">
            <IndicatorPicker />
          </ChartView>
        ) : (
          <p>Loading indicator catalog…</p>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
