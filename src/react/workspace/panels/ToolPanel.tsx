/**
 * ToolPanel — workspace panel with drawing-tool shortcuts.
 */

import type { PanelInstance } from "../../../workspace";

export interface ToolConfig {
  activeTool?: string;
}

const TOOLS = ["cursor", "trendline", "ray", "rectangle", "fibonacci", "ruler"];

export function ToolPanel({
  instance,
  updateConfig,
}: {
  instance: PanelInstance<ToolConfig>;
  updateConfig: (next: Partial<ToolConfig>) => void;
}) {
  const active = instance.config.activeTool ?? "cursor";

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--app-muted)" }}>
        Drawing Tools
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {TOOLS.map((tool) => (
          <button
            key={tool}
            onClick={() => updateConfig({ activeTool: tool })}
            style={{
              textAlign: "left",
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--app-border)",
              background: active === tool ? "var(--app-fg)" : "var(--app-panel)",
              color: active === tool ? "var(--app-bg)" : "var(--app-fg)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              textTransform: "capitalize",
            }}
          >
            {tool}
          </button>
        ))}
      </div>
    </div>
  );
}
