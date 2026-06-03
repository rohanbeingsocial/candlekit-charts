import { useEffect, useState, type CSSProperties } from "react";
import type { DrawingToolId } from "../drawing/types";
import { useChartApi } from "./context";

export interface DrawingToolbarProps {
  /** Tools to show, in order. Defaults to the common set. */
  tools?: { id: DrawingToolId; label: string; title?: string }[];
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_TOOLS: { id: DrawingToolId; label: string; title?: string }[] = [
  { id: "TrendLine", label: "╱", title: "Trend line" },
  { id: "Ray", label: "→", title: "Ray" },
  { id: "ExtendedLine", label: "↔", title: "Extended line" },
  { id: "HorizontalLine", label: "─", title: "Horizontal line" },
  { id: "HorizontalRay", label: "─→", title: "Horizontal ray" },
  { id: "VerticalLine", label: "│", title: "Vertical line" },
  { id: "CrossLine", label: "✛", title: "Cross line" },
  { id: "Arrow", label: "↗", title: "Arrow" },
  { id: "Rectangle", label: "▭", title: "Rectangle" },
  { id: "Circle", label: "◯", title: "Ellipse" },
  { id: "Triangle", label: "△", title: "Triangle" },
  { id: "ParallelChannel", label: "▱", title: "Parallel channel" },
  { id: "PriceRange", label: "↕", title: "Price range" },
  { id: "DateRange", label: "↔|", title: "Date range" },
  { id: "FibRetracement", label: "Fib", title: "Fibonacci retracement" },
  { id: "FibExtension", label: "FibE", title: "Fibonacci extension" },
];

/**
 * Toolbar wired to the enclosing {@link ChartView}'s drawing plugin. Renders
 * nothing if drawing is not enabled. Headless-friendly: style it via CSS class
 * `ck-toolbar` / `ck-toolbar-btn` (see styles.css) or your own classes.
 */
export function DrawingToolbar({ tools = DEFAULT_TOOLS, className, style }: DrawingToolbarProps) {
  const { drawing } = useChartApi();
  const [active, setActive] = useState<DrawingToolId | null>(null);
  const [locked, setLocked] = useState(false);
  const engine = drawing?.engine ?? null;

  // Reflect the engine's active tool + lock state (cleared automatically after a
  // drawing is committed).
  useEffect(() => {
    if (!engine) return;
    return engine.onChange(() => {
      setActive(engine.getActiveTool());
      setLocked(engine.isLocked());
    });
  }, [engine]);

  if (!engine) return null;

  const start = (id: DrawingToolId) => {
    engine.startTool(id);
    setActive(id);
  };

  return (
    <div className={className ?? "ck-toolbar"} style={style}>
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.title ?? t.id}
          className="ck-toolbar-btn"
          aria-pressed={active === t.id}
          data-active={active === t.id || undefined}
          onClick={() => start(t.id)}
        >
          {t.label}
        </button>
      ))}
      <button
        type="button"
        title="Delete selected"
        className="ck-toolbar-btn"
        onClick={() => engine.removeSelected()}
      >
        ⌫
      </button>
      <button type="button" title="Clear all" className="ck-toolbar-btn" onClick={() => engine.removeAll()}>
        ✕
      </button>
      <button
        type="button"
        title={locked ? "Unlock drawings" : "Lock drawings"}
        className="ck-toolbar-btn"
        data-active={locked || undefined}
        onClick={() => {
          const next = !locked;
          engine.setLocked(next);
          setLocked(next);
        }}
      >
        {locked ? "🔒" : "🔓"}
      </button>
    </div>
  );
}
