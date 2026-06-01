/**
 * IndicatorPanel — workspace panel listing active indicators.
 */

import type { PanelInstance } from "../../../workspace";

export interface IndicatorConfig {
  active?: string[];
}

const BUILTINS = ["SMA", "EMA", "RSI", "MACD", "Bollinger", "ATR", "Stochastic"];

export function IndicatorPanel({
  instance,
  updateConfig,
}: {
  instance: PanelInstance<IndicatorConfig>;
  updateConfig: (next: Partial<IndicatorConfig>) => void;
}) {
  const active = new Set(instance.config.active ?? []);

  const toggle = (name: string) => {
    const next = new Set(active);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    updateConfig({ active: Array.from(next) });
  };

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--app-muted)" }}>
        Indicators
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {BUILTINS.map((name) => (
          <button
            key={name}
            onClick={() => toggle(name)}
            style={{
              textAlign: "left",
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--app-border)",
              background: active.has(name) ? "var(--app-fg)" : "var(--app-panel)",
              color: active.has(name) ? "var(--app-bg)" : "var(--app-fg)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {active.has(name) ? "✓ " : ""}{name}
          </button>
        ))}
      </div>
    </div>
  );
}
