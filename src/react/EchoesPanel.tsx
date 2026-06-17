import { useEffect, useState, type CSSProperties } from "react";
import { useChartApi } from "./context";
import type { EchoScan } from "../lab/types";

export interface EchoesPanelProps {
  /** Initial query window length (bars). Default 30. */
  defaultWindowLen?: number;
  /** Initial aftermath horizon (bars). Default 30. */
  defaultHorizon?: number;
  className?: string;
  style?: CSSProperties;
}

const fmtSigned = (n: number, dec = 2) => (n >= 0 ? "+" : "") + n.toFixed(dec);

/** Tiny inline SVG sparkline over a value series. Returns null if too short. */
function Sparkline({
  values,
  width = 96,
  height = 26,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!values || values.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const dx = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * dx).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`);
  const last = values[values.length - 1];
  const cls = `ck-spark ${last >= 0 ? "ck-spark--up" : "ck-spark--down"}${className ? ` ${className}` : ""}`;

  // Zero baseline (only when the range straddles zero).
  const zeroY = min < 0 && max > 0 ? (height - ((0 - min) / span) * height).toFixed(1) : null;

  return (
    <svg className={cls} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {zeroY && <line x1="0" y1={zeroY} x2={width} y2={zeroY} className="ck-spark-zero" />}
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Results panel for Echoes ("market déjà vu"): a control row (window / horizon /
 * run / clear), an aggregate outcome strip, the projected median path, and the
 * ranked historical echoes with their aftermath sparklines. Reads the enclosing
 * {@link ChartView}'s echoes controller — enable `echoes` on the chart for this
 * to appear.
 */
export function EchoesPanel({
  defaultWindowLen = 30,
  defaultHorizon = 30,
  className,
  style,
}: EchoesPanelProps) {
  const { echoes } = useChartApi();
  const [scan, setScan] = useState<EchoScan | null>(null);
  const [windowLen, setWindowLen] = useState(defaultWindowLen);
  const [horizon, setHorizon] = useState(defaultHorizon);

  useEffect(() => echoes?.subscribe(setScan), [echoes]);

  if (!echoes) return null;

  const run = () => {
    // setConfig re-runs once a scan exists; the first run needs an explicit call.
    const first = echoes.getScan() === null;
    echoes.setConfig({ windowLen, horizon });
    if (first) echoes.run();
  };
  const clear = () => echoes.clear();

  const s = scan?.stats;
  const upRate = s && s.count > 0 ? Math.round((s.upCount / s.count) * 100) : 0;

  return (
    <div className={className ?? "ck-lab-panel"} style={style}>
      <div className="ck-lab-row">
        <label className="ck-lab-field">
          <span>Window</span>
          <input
            type="number"
            min={2}
            value={windowLen}
            onChange={(e) => setWindowLen(Math.max(2, Number(e.target.value) || 2))}
          />
        </label>
        <label className="ck-lab-field">
          <span>Horizon</span>
          <input
            type="number"
            min={1}
            value={horizon}
            onChange={(e) => setHorizon(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <button type="button" className="ck-lab-run" onClick={run}>
          Scan
        </button>
        <button type="button" className="ck-lab-clear" onClick={clear}>
          Clear
        </button>
      </div>

      {scan && s && (
        <>
          <div className="ck-lab-stats">
            <Stat label="Echoes" value={String(s.count)} />
            <Stat label="Up" value={`${upRate}%`} tone={upRate >= 50 ? "up" : "down"} />
            <Stat label="Median" value={`${fmtSigned(s.medianEndPct)}%`} tone={s.medianEndPct >= 0 ? "up" : "down"} />
            <Stat label="Best" value={`${fmtSigned(s.bestEndPct)}%`} tone="up" />
            <Stat label="Worst" value={`${fmtSigned(s.worstEndPct)}%`} tone="down" />
          </div>

          {scan.medianPathPct.length > 0 && (
            <div className="ck-lab-proj">
              <span className="ck-lab-proj-label">Projected median path</span>
              <Sparkline values={scan.medianPathPct} width={180} height={32} />
            </div>
          )}

          <div className="ck-lab-matches">
            {scan.results.map((r, i) => {
              const after = r.aftermathPct;
              const end = after && after.length ? after[after.length - 1] : null;
              return (
                <div className="ck-lab-match" key={`${r.match.startIndex}-${i}`}>
                  <span className="ck-lab-match-rank">#{i + 1}</span>
                  <Sparkline values={after ?? []} />
                  <span className="ck-lab-match-dist" title="z-normalized distance (lower = closer)">
                    d {r.match.distance.toFixed(2)}
                  </span>
                  {end != null && (
                    <span className={`ck-lab-match-end ck-tone--${end >= 0 ? "up" : "down"}`}>
                      {fmtSigned(end)}%
                    </span>
                  )}
                </div>
              );
            })}
            {scan.results.length === 0 && <div className="ck-lab-empty">No echoes found.</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="ck-stat">
      <span className="ck-stat-label">{label}</span>
      <span className={`ck-stat-value${tone ? ` ck-tone--${tone}` : ""}`}>{value}</span>
    </div>
  );
}
