import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ChartView, IndicatorPicker, IndicatorController, createBuiltinRegistry } from "@candlekit/charts/react";
import "@candlekit/charts/styles.css";
import { generateBars } from "../shared/sampleData";

function App() {
  const data = useMemo(() => generateBars(600), []);
  // Built-in MIT catalog — no external indicator runtime.
  const indicators = useMemo(() => {
    const ctl = new IndicatorController(createBuiltinRegistry());
    ctl.add("EMA", { length: 21 });
    ctl.add("RSI", { length: 14 });
    return ctl;
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <p>Toggle indicators in the panel (top-right). Overlays draw on price; oscillators get their own pane.</p>
      <div style={{ height: "75vh" }}>
        <ChartView data={data} indicators={indicators} theme="dark">
          <IndicatorPicker />
        </ChartView>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
