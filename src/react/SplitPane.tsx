/**
 * SplitPane — a minimal, dependency-free resizable two-pane split.
 *
 * Deliberately tiny: no docking, no persistence, no layout manager. Compose it
 * (nest SplitPanes) for arbitrary multi-chart grids. Resizing only changes a
 * flex-basis, so child charts keep their instance and autosize — no remount.
 *
 *   <SplitPane direction="horizontal">
 *     <ChartView … />
 *     <SplitPane direction="vertical"><ChartView … /><ChartView … /></SplitPane>
 *   </SplitPane>
 */

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";

export interface SplitPaneProps {
  /** `horizontal` = side-by-side (vertical gutter); `vertical` = stacked. */
  direction?: "horizontal" | "vertical";
  /** Initial size of the first pane as a fraction [0..1]. Default 0.5. */
  initial?: number;
  /** Minimum px kept on each side while dragging. Default 80. */
  min?: number;
  /** Gutter thickness in px. Default 6. */
  gutter?: number;
  /** Exactly two children. */
  children: [ReactNode, ReactNode];
  className?: string;
  style?: CSSProperties;
}

export function SplitPane({
  direction = "horizontal",
  initial = 0.5,
  min = 80,
  gutter = 6,
  children,
  className,
  style,
}: SplitPaneProps) {
  const horizontal = direction === "horizontal";
  const [fraction, setFraction] = useState(clamp01(initial));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = horizontal ? rect.width : rect.height;
      if (total <= 0) return;
      const pos = horizontal ? clientX - rect.left : clientY - rect.top;
      const minF = min / total;
      setFraction(clamp(pos / total, minF, 1 - minF));
    },
    [horizontal, min],
  );

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const move = (ev: PointerEvent) => dragging.current && onMove(ev.clientX, ev.clientY);
      const up = () => {
        dragging.current = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onMove],
  );

  const pct = fraction * 100;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}
    >
      <div style={{ flex: `0 0 ${pct}%`, minWidth: 0, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {children[0]}
      </div>
      <div
        role="separator"
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        onPointerDown={startDrag}
        style={{
          flex: `0 0 ${gutter}px`,
          cursor: horizontal ? "col-resize" : "row-resize",
          background: "var(--ck-border, rgba(127,127,127,0.3))",
          touchAction: "none",
          userSelect: "none",
        }}
      />
      <div style={{ flex: "1 1 0", minWidth: 0, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {children[1]}
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
