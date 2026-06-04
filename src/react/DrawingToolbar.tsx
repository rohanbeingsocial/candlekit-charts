import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { DrawingToolId } from "../drawing/types";
import { useChartApi } from "./context";

export interface DrawingToolbarProps {
  /** Tools to show, in order. Defaults to the common set. */
  tools?: { id: DrawingToolId; label: string; title?: string; icon?: ReactNode }[];
  className?: string;
  style?: CSSProperties;
}

// ── Inline line-art icons (no icon dependency) ───────────────────────────────
// 24×24 stroke icons, rendered at 15px to match the host trading-dashboard
// drawing toolbar (lucide line weight). currentColor follows the button state.
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

/** Default glyph for each built-in tool id. Custom tools fall back to `label`. */
const TOOL_ICONS: Record<string, ReactNode> = {
  TrendLine: <Svg><polyline points="3 17 9 11 13 15 21 6" /></Svg>,
  Ray: (
    <Svg>
      <line x1="4" y1="20" x2="20" y2="4" />
      <polyline points="11 4 20 4 20 13" />
    </Svg>
  ),
  ExtendedLine: (
    <Svg>
      <line x1="3" y1="19" x2="21" y2="5" />
      <circle cx="8.2" cy="14.7" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="9.3" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  ),
  HorizontalLine: <Svg><line x1="3" y1="12" x2="21" y2="12" /></Svg>,
  HorizontalRay: (
    <Svg>
      <line x1="3" y1="12" x2="21" y2="12" />
      <polyline points="15 7 21 12 15 17" />
    </Svg>
  ),
  VerticalLine: <Svg><line x1="12" y1="3" x2="12" y2="21" /></Svg>,
  CrossLine: (
    <Svg>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </Svg>
  ),
  Arrow: (
    <Svg>
      <line x1="4" y1="20" x2="18" y2="6" />
      <polyline points="11 5 19 5 19 13" />
    </Svg>
  ),
  Rectangle: <Svg><rect x="3" y="5" width="18" height="14" rx="1.5" /></Svg>,
  Circle: <Svg><circle cx="12" cy="12" r="9" /></Svg>,
  Triangle: <Svg><path d="M12 4 L21 20 H3 Z" /></Svg>,
  ParallelChannel: (
    <Svg>
      <line x1="3" y1="15" x2="21" y2="7" />
      <line x1="3" y1="20" x2="21" y2="12" />
    </Svg>
  ),
  PriceRange: (
    <Svg>
      <line x1="12" y1="3" x2="12" y2="21" />
      <polyline points="8 7 12 3 16 7" />
      <polyline points="8 17 12 21 16 17" />
    </Svg>
  ),
  DateRange: (
    <Svg>
      <line x1="3" y1="12" x2="21" y2="12" />
      <polyline points="7 8 3 12 7 16" />
      <polyline points="17 8 21 12 17 16" />
    </Svg>
  ),
  FibRetracement: (
    <Svg>
      <line x1="3" y1="5" x2="21" y2="5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="14" x2="21" y2="14" />
      <line x1="3" y1="19" x2="21" y2="19" />
    </Svg>
  ),
  FibExtension: (
    <Svg>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3" y2="18" />
    </Svg>
  ),
};

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
 * nothing if drawing is not enabled. Each built-in tool ships an inline SVG
 * glyph (no icon dependency); custom tools fall back to their `label` text.
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
            {t.icon ?? TOOL_ICONS[t.id] ?? t.label}
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
