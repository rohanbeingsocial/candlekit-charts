import { StrictMode, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ChartView, DrawingToolbar } from "@candlekit/charts/react";
import "@candlekit/charts/styles.css";
import { generateBars } from "@candlekit/charts";

function App() {
  const data = useMemo(() => generateBars(600), []);

  return (
    <div style={{ padding: 12 }}>
      <p>
        Pick a tool on the left and click to draw (one click for h/v lines, two for the rest). Click a
        drawing to select; drag its body to move or a handle to reshape. Delete/Backspace removes it.
        Hold Shift and drag to measure. Drawings persist to localStorage.
      </p>
      <div style={{ height: "75vh" }}>
        {/* `drawing` can be true, an options object, or a DrawingController instance. */}
        <ChartView data={data} drawing={{ storageKey: "candlekit:example:drawings" }} measurement theme="dark">
          <DrawingToolbar />
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
