import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useChartApi } from "./context";
import type { SketchSearchResult } from "../lab/SketchSearchController";

export interface SketchSearchButtonProps {
  /** Button label (text shown next to the icon). Default "Sketch". */
  label?: string;
  /** Replace the default glyph. */
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const ICON = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* a pencil drawing a wave */}
    <path d="M3 17c2-4 4-4 6 0s4 4 6 0" />
    <path d="M14 6l4 4-8 8-4 1 1-4 7-9z" />
  </svg>
);

/**
 * Toggle button that arms / disarms Sketch Search on the enclosing
 * {@link ChartView}. While armed, drag a freehand shape across the chart; on
 * release the matching historical windows are highlighted. Renders nothing if
 * sketch search is not enabled. A small badge shows the latest match count.
 */
export function SketchSearchButton({ label = "Sketch", icon, className, style }: SketchSearchButtonProps) {
  const { sketch } = useChartApi();
  const [active, setActive] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => sketch?.subscribe((r: SketchSearchResult | null) => setCount(r ? r.matches.length : null)), [sketch]);

  if (!sketch) return null;

  const toggle = () => {
    const next = !active;
    sketch.setActive(next);
    setActive(next);
  };

  return (
    <button
      type="button"
      className={className ?? "ck-toolbar-btn ck-lab-btn"}
      title="Sketch search — draw a shape to find look-alikes"
      aria-label="Sketch search"
      aria-pressed={active}
      data-active={active || undefined}
      onClick={toggle}
      style={style}
    >
      {icon ?? ICON}
      <span className="ck-lab-btn-label">{label}</span>
      {count != null && <span className="ck-badge">{count}</span>}
    </button>
  );
}
