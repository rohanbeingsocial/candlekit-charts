/**
 * WatchlistPanel — simple workspace panel showing a list of symbols.
 */

import { useState } from "react";
import type { PanelInstance } from "../../../workspace";

export interface WatchlistConfig {
  symbols?: string[];
}

export function WatchlistPanel({
  instance,
  updateConfig,
}: {
  instance: PanelInstance<WatchlistConfig>;
  updateConfig: (next: Partial<WatchlistConfig>) => void;
}) {
  const symbols = instance.config.symbols ?? ["DEMO"];
  const [input, setInput] = useState("");

  const add = () => {
    if (!input.trim()) return;
    updateConfig({ symbols: [...symbols, input.trim().toUpperCase()] });
    setInput("");
  };

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Symbol"
          style={inputStyle}
        />
        <button onClick={add} style={btnStyle}>
          Add
        </button>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {symbols.map((s) => (
          <li
            key={s}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              background: "var(--app-panel)",
              border: "1px solid var(--app-border)",
            }}
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--app-bg)",
  color: "var(--app-fg)",
  border: "1px solid var(--app-border)",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  fontFamily: "inherit",
  flex: 1,
};

const btnStyle: React.CSSProperties = {
  background: "var(--app-bg)",
  color: "var(--app-fg)",
  border: "1px solid var(--app-border)",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};
