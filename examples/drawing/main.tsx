import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChartView, DrawingToolbar } from "@candlekit/charts/react";
import type { DrawingPlugin } from "@candlekit/charts";
import { createLineToolsDrawingPlugin } from "@candlekit/charts/drawing-linetools";
import "@candlekit/charts/styles.css";
import { generateBars } from "../shared/sampleData";

function App() {
  const data = useMemo(() => generateBars(600), []);
  const [drawing, setDrawing] = useState<DrawingPlugin | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    createLineToolsDrawingPlugin({ storageKey: "candlekit:example:drawings" })
      .then((p) => live && setDrawing(p))
      .catch((e) => live && setErr(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <p>
        Pick a tool on the left and draw. Shift-drag measures. Drawings persist to localStorage. Hold Shift
        and drag to use the measurement ruler.
      </p>
      {err && (
        <p style={{ color: "#ef5350" }}>
          Drawing runtime not installed. Run the install command in examples/drawing/README.md. ({err})
        </p>
      )}
      <div style={{ height: "75vh" }}>
        <ChartView data={data} drawing={drawing} measurement theme="dark">
          {drawing && <DrawingToolbar />}
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
