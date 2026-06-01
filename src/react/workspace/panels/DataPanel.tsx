/**
 * DataPanel — workspace panel showing sample data stats.
 */

import { useMemo } from "react";
import type { PanelInstance } from "../../../workspace";
import { generateBars } from "../../../../examples/shared/sampleData";
import { toBars } from "../../../core/data";

export interface DataConfig {
  count?: number;
}

export function DataPanel({
  instance,
}: {
  instance: PanelInstance<DataConfig>;
}) {
  const count = instance.config.count ?? 100;
  const bars = useMemo(() => toBars(generateBars(count)), [count]);
  const last = bars[bars.length - 1];

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--app-muted)" }}>
        Data Snapshot
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--app-muted)" }}>Bars</span>
          <span>{bars.length}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--app-muted)" }}>Open</span>
          <span>{last?.open.toFixed(2) ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--app-muted)" }}>High</span>
          <span>{last?.high.toFixed(2) ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--app-muted)" }}>Low</span>
          <span>{last?.low.toFixed(2) ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--app-muted)" }}>Close</span>
          <span>{last?.close.toFixed(2) ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
