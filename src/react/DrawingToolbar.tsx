import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { DRAWING_TOOL_ICONS } from "../drawing/icons";
import type { DrawingToolId } from "../drawing/types";
import { useChartApi } from "./context";

export interface DrawingToolbarProps {
  /** Tools to show, in order. Defaults to the common set. */
  tools?: { id: DrawingToolId; label: string; title?: string; icon?: ReactNode }[];
  className?: string;
  style?: CSSProperties;
}

// CandleKit owns the drawing glyph path data. This renderer only turns that
// framework-neutral definition into an SVG element.
function Svg({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}

function ToolIcon({ id }: { id: DrawingToolId }): ReactNode {
  const icon = DRAWING_TOOL_ICONS[id];
  return icon ? (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  ) : null;
}

const ICON_DELETE = (
  <Svg>
    <polyline points="3 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
    <path d="M9 6V4h6v2" />
  </Svg>
);
const ICON_CLEAR = (
  <Svg>
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </Svg>
);
const ICON_LOCKED = (
  <Svg>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
const ICON_UNLOCKED = (
  <Svg>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 0 1 7.6-1.6" />
  </Svg>
);

const DEFAULT_TOOLS: NonNullable<DrawingToolbarProps["tools"]> = [
  { id: "TrendLine", label: "Trend line" },
  { id: "Ray", label: "Ray" },
  { id: "ExtendedLine", label: "Extended line" },
  { id: "HorizontalLine", label: "Horizontal line" },
  { id: "HorizontalRay", label: "Horizontal ray" },
  { id: "VerticalLine", label: "Vertical line" },
  { id: "CrossLine", label: "Cross line" },
  { id: "Arrow", label: "Arrow" },
  { id: "Rectangle", label: "Rectangle" },
  { id: "Circle", label: "Ellipse" },
  { id: "Triangle", label: "Triangle" },
  { id: "ParallelChannel", label: "Parallel channel" },
  { id: "PriceRange", label: "Price range" },
  { id: "DateRange", label: "Date range" },
  { id: "FibRetracement", label: "Fib retracement" },
  { id: "FibExtension", label: "Fib extension" },
];

// Tool groups (parity with the host toolbar): line tools, then shape/measure
// tools, then fib tools — rendered with a thin separator between groups.
const GROUP_BREAK_AFTER = new Set<DrawingToolId>(["Arrow", "ParallelChannel"]);

/**
 * Toolbar wired to the enclosing {@link ChartView}'s drawing plugin. Renders
 * nothing if drawing is not enabled. Each built-in tool gets its glyph from
 * CandleKit's shared icon registry; callers may still provide custom icons.
 * Style it via CSS class `ck-toolbar` / `ck-toolbar-btn` (see styles.css).
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
        <span key={t.id} style={{ display: "contents" }}>
          <button
            type="button"
            title={t.title ?? t.label}
            aria-label={t.label}
            className="ck-toolbar-btn"
            aria-pressed={active === t.id}
            data-active={active === t.id || undefined}
            onClick={() => start(t.id)}
          >
            {t.icon ?? (DRAWING_TOOL_ICONS[t.id] ? <ToolIcon id={t.id} /> : t.label)}
          </button>
          {GROUP_BREAK_AFTER.has(t.id) && <span className="ck-toolbar-sep" aria-hidden="true" />}
        </span>
      ))}
      <span className="ck-toolbar-sep" aria-hidden="true" />
      <button
        type="button"
        title="Delete selected"
        aria-label="Delete selected"
        className="ck-toolbar-btn"
        onClick={() => engine.removeSelected()}
      >
        {ICON_DELETE}
      </button>
      <button
        type="button"
        title="Clear all"
        aria-label="Clear all"
        className="ck-toolbar-btn"
        onClick={() => engine.removeAll()}
      >
        {ICON_CLEAR}
      </button>
      <button
        type="button"
        title={locked ? "Unlock drawings" : "Lock drawings"}
        aria-label={locked ? "Unlock drawings" : "Lock drawings"}
        className="ck-toolbar-btn"
        data-active={locked || undefined}
        onClick={() => {
          const next = !locked;
          engine.setLocked(next);
          setLocked(next);
        }}
      >
        {locked ? ICON_LOCKED : ICON_UNLOCKED}
      </button>
    </div>
  );
}
