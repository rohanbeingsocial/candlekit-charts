import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Bar } from "../core/types";
import { useChartApi } from "./context";

interface IndValue {
  name: string;
  title: string;
  paneIndex: number;
  plots: Array<{ label: string; value: number | null; color: string }>;
}

interface LegendState {
  bar: Bar;
  indicators: IndValue[];
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(2);
  if (abs >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function findBarAt(bars: readonly Bar[], tsSeconds: number): Bar | undefined {
  let lo = 0,
    hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = Math.floor(bars[mid].ts / 1000);
    if (t === tsSeconds) return bars[mid];
    if (t < tsSeconds) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

function getPaneTop(chart: { panes(): unknown[] }, paneIndex: number): number {
  try {
    const panes = chart.panes();
    let top = 0;
    for (let i = 0; i < paneIndex && i < panes.length; i++) {
      top += (panes[i] as { getHeight(): number }).getHeight();
    }
    return top;
  } catch {
    return 0;
  }
}

export interface CrosshairLegendProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * TradingView-style crosshair legend. Place inside a {@link ChartView}.
 * - Shows OHLCV for the hovered bar; defaults to the last bar when not hovering.
 * - Indicator values appear vertically below OHLCV in the main pane legend.
 * - Oscillator indicators (RSI, MACD, …) get their own mini-legend pinned to
 *   the top of their pane.
 */
export function CrosshairLegend({ className, style }: CrosshairLegendProps = {}) {
  const { controller, indicators } = useChartApi();
  const [state, setState] = useState<LegendState | null>(null);
  const hoveringRef = useRef(false);

  function stateFromLastBar(): LegendState | null {
    const bars = controller.getBars();
    if (bars.length === 0) return null;
    const last = bars[bars.length - 1];
    const tsSeconds = Math.floor(last.ts / 1000);
    return { bar: last, indicators: indicators ? indicators.getValuesAt(tsSeconds) : [] };
  }

  // Initialise with the last bar as soon as bars are available.
  useEffect(() => {
    setState(stateFromLastBar());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubs = [
      controller.bus.on("crosshairMove", (event) => {
        if (!event) {
          hoveringRef.current = false;
          setState(stateFromLastBar());
          return;
        }
        hoveringRef.current = true;
        const tsSeconds = Math.floor(event.ts / 1000);
        const bar = findBarAt(controller.getBars(), tsSeconds);
        if (!bar) return;
        setState({ bar, indicators: indicators ? indicators.getValuesAt(tsSeconds) : [] });
      }),
      controller.bus.on("data", ({ bars }) => {
        if (hoveringRef.current || bars.length === 0) return;
        const last = bars[bars.length - 1];
        const tsSeconds = Math.floor(last.ts / 1000);
        setState({ bar: last, indicators: indicators ? indicators.getValuesAt(tsSeconds) : [] });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, indicators]);

  if (!state) return null;
  const { bar, indicators: indVals } = state;
  const isUp = bar.close >= bar.open;
  const priceColor = isUp ? "var(--ck-up, #26a69a)" : "var(--ck-down, #ef5350)";

  // Split overlay indicators (pane 0) from oscillator indicators (pane 1+).
  const overlayInds = indVals.filter((v) => v.paneIndex === 0);
  const oscByPane = new Map<number, IndValue[]>();
  for (const v of indVals) {
    if (v.paneIndex > 0) {
      if (!oscByPane.has(v.paneIndex)) oscByPane.set(v.paneIndex, []);
      oscByPane.get(v.paneIndex)!.push(v);
    }
  }

  const chart = controller.getChart();
  const baseLeft = (style?.left as number | undefined) ?? 8;

  return (
    <>
      {/* ── Main pane legend: OHLCV + overlay indicators ── */}
      <div className={className ?? "ck-crosshair-legend"} style={{ ...S.wrap, ...style }}>
        {/* OHLCV row — always horizontal */}
        <div style={S.ohlcRow}>
          <span style={S.lbl}>O</span>
          <span style={{ ...S.val, color: priceColor }}>{fmtPrice(bar.open)}</span>
          <span style={S.gap} />
          <span style={S.lbl}>H</span>
          <span style={{ ...S.val, color: priceColor }}>{fmtPrice(bar.high)}</span>
          <span style={S.gap} />
          <span style={S.lbl}>L</span>
          <span style={{ ...S.val, color: priceColor }}>{fmtPrice(bar.low)}</span>
          <span style={S.gap} />
          <span style={S.lbl}>C</span>
          <span style={{ ...S.val, color: priceColor }}>{fmtPrice(bar.close)}</span>
          {bar.volume != null && bar.volume > 0 && (
            <>
              <span style={S.gap} />
              <span style={S.lbl}>Vol</span>
              <span style={S.val}>{fmtVol(bar.volume)}</span>
            </>
          )}
        </div>

        {/* Overlay indicator rows — one per line */}
        {overlayInds.map((iv) => (
          <div key={iv.name} style={S.indRow}>
            <span style={{ ...S.dot, background: iv.plots[0]?.color ?? "#888" }} />
            <span style={S.indName}>{iv.title}</span>
            {iv.plots.map((p, i) => (
              <span key={i} style={{ ...S.indVal, color: p.color }}>
                {p.value != null ? fmtPrice(p.value) : "—"}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* ── Oscillator pane mini-legends ── */}
      {[...oscByPane.entries()].map(([paneIdx, inds]) => (
        <div
          key={paneIdx}
          className={className ?? "ck-crosshair-legend"}
          style={{
            ...S.wrap,
            top: getPaneTop(chart, paneIdx) + 4,
            left: baseLeft,
          }}
        >
          {inds.map((iv) => (
            <div key={iv.name} style={S.indRow}>
              <span style={{ ...S.dot, background: iv.plots[0]?.color ?? "#888" }} />
              <span style={S.indName}>{iv.title}</span>
              {iv.plots.map((p, i) => (
                <span key={i} style={{ ...S.indVal, color: p.color }}>
                  {p.value != null ? fmtPrice(p.value) : "—"}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "3px 8px",
    fontSize: 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "var(--app-fg)",
    background: "color-mix(in srgb, var(--app-panel, #1e222d) 85%, transparent)",
    border: "1px solid color-mix(in srgb, var(--app-border, #2a2d3e) 60%, transparent)",
    borderRadius: 4,
    backdropFilter: "blur(4px)",
    pointerEvents: "none",
    userSelect: "none",
  },
  ohlcRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  lbl: {
    color: "var(--app-muted, #636d8a)",
    marginRight: 2,
  },
  val: {
    fontVariantNumeric: "tabular-nums",
  },
  gap: {
    width: 6,
    display: "inline-block",
    flexShrink: 0,
  },
  indRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
    display: "inline-block",
  },
  indName: {
    color: "var(--app-muted, #636d8a)",
  },
  indVal: {
    fontVariantNumeric: "tabular-nums",
  },
};
