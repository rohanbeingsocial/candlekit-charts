import { useMemo, useState, type CSSProperties } from "react";
import type { IndicatorCategory, IndicatorDef } from "../indicators/types";
import { useChartApi } from "./context";

export interface IndicatorPickerProps {
  className?: string;
  style?: CSSProperties;
  /** Category section order + labels. */
  categories?: { key: IndicatorCategory; label: string }[];
}

const DEFAULT_CATEGORIES: { key: IndicatorCategory; label: string }[] = [
  { key: "overlay", label: "Overlays" },
  { key: "oscillator", label: "Oscillators" },
  { key: "pattern", label: "Patterns" },
];

/**
 * Indicator on/off picker wired to the enclosing {@link ChartView}'s indicator
 * controller. Renders nothing if indicators are not enabled.
 */
export function IndicatorPicker({ className, style, categories = DEFAULT_CATEGORIES }: IndicatorPickerProps) {
  const { indicators } = useChartApi();
  const grouped = useMemo(() => indicators?.available() ?? null, [indicators]);
  const [active, setActive] = useState<Set<string>>(new Set(indicators?.activeNames() ?? []));

  if (!indicators || !grouped) return null;

  const toggle = (def: IndicatorDef) => {
    indicators.toggle(def.name);
    setActive(new Set(indicators.activeNames()));
  };

  return (
    <div className={className ?? "ck-picker"} style={style}>
      {categories.map(({ key, label }) => {
        const list = grouped[key];
        if (!list || list.length === 0) return null;
        return (
          <div key={key} className="ck-picker-section">
            <div className="ck-picker-heading">{label}</div>
            {list.map((def) => (
              <label key={def.name} className="ck-picker-row">
                <input type="checkbox" checked={active.has(def.name)} onChange={() => toggle(def)} />
                <span>{def.title}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
