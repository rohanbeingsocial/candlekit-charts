import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MeasurementResult } from "../measurement/types";
import { useChartApi } from "./context";

export interface MeasurementOverlayProps {
  className?: string;
  style?: CSSProperties;
}

const BOX_W = 164;
const BOX_H = 74;

const fmtSigned = (n: number, dec = 2) => (n >= 0 ? "+" : "") + n.toFixed(dec);

const fmtTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

/**
 * Floating readout for the Shift-drag measurement ruler: percentage move
 * (primary), absolute points, and bar-count · time-delta. Renders nothing until
 * a measurement exists. Reads the enclosing {@link ChartView}'s measurement
 * controller — enable measurement on the chart for this to appear.
 */
export function MeasurementOverlay({ className, style }: MeasurementOverlayProps) {
  const { measurement } = useChartApi();
  const [result, setResult] = useState<MeasurementResult | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => measurement?.subscribe(setResult), [measurement]);

  if (!measurement) return null;

  let pos: { left: number; top: number } | null = null;
  if (result) {
    const cw = layerRef.current?.offsetWidth ?? 0;
    const ch = layerRef.current?.offsetHeight ?? 0;
    let left = result.end.x + 14;
    let top = result.end.y - 36;
    if (left + BOX_W > cw - 6) left = result.end.x - BOX_W - 14;
    if (top < 6) top = 6;
    if (top + BOX_H > ch - 6) top = ch - BOX_H - 6;
    pos = { left, top };
  }

  return (
    <div ref={layerRef} className={className ?? "ck-measure-layer"} style={style}>
      {result && pos && (
        <div
          className={`ck-measure ck-measure--${result.direction}`}
          style={{ left: pos.left, top: pos.top, width: BOX_W }}
        >
          <div className="ck-measure-pct">{fmtSigned(result.pricePct, 2)}%</div>
          <div className="ck-measure-pts">
            {fmtSigned(result.priceDiff, Math.abs(result.priceDiff) >= 10 ? 1 : 2)} pts
          </div>
          <div className="ck-measure-meta">
            {result.barCount} bar{result.barCount !== 1 ? "s" : ""} · {fmtTime(result.timeDiffSeconds)}
          </div>
        </div>
      )}
    </div>
  );
}
