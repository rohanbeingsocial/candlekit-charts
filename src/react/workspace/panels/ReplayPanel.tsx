/**
 * ReplayPanel — standalone bar-by-bar replay pane.
 *
 * A dedicated workspace panel kind that shows up in the "+ Add Panel" menu: a
 * chart wired straight into a ReplayController + transport dock, scrubbing a
 * synthetic intraday session. Unlike ChartPanel's per-pane replay *toggle*,
 * replay is always on here — the pane *is* the replay surface. Shares the
 * synthetic-session helpers with ChartPanel via ./replaySession so the two
 * never drift.
 *
 * Config shape: { symbol: string; interval: string; seriesType?: SeriesType }
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChartView,
  ReplayControls,
  createReplayController,
  resample,
  type ChartViewApi,
  type SeriesType,
  type ReplayController,
  usePageTheme,
} from "../../index";
import { generateBars, type RawBar } from "../../../core/data";
import type { PanelInstance } from "../../../workspace";
import { PanelContext } from "./PanelContext";
import {
  SESSION_START,
  NO_DATA,
  SYMBOL_PRICE,
  intervalMinutes,
  buildSession,
  buildJumps,
  fmtClock,
} from "./replaySession";

export interface ReplayPanelConfig {
  symbol?: string;
  interval?: string;
  seriesType?: SeriesType;
  theme?: "dark" | "light";
}

export const DEFAULT_REPLAY_CONFIG: ReplayPanelConfig = {
  symbol: "DEMO",
  interval: "1m",
  seriesType: "candlestick",
  // No `theme` default: follow the page theme (usePageTheme) unless overridden.
};

/** Timeframes offered in the control pill (parity with ChartPanel). */
const PANEL_INTERVALS: readonly string[] = ["1m", "5m", "15m", "30m", "1h"];

export function ReplayPanel({
  instance,
  updateConfig,
}: {
  instance: PanelInstance<ReplayPanelConfig>;
  updateConfig: (next: Partial<ReplayPanelConfig>) => void;
}) {
  const config = { ...DEFAULT_REPLAY_CONFIG, ...instance.config };
  return (
    <PanelContext.Provider value={{ instance, updateConfig }}>
      <ReplayPanelInner config={config} panelId={instance.id} updateConfig={updateConfig} />
    </PanelContext.Provider>
  );
}

function ReplayPanelInner({
  config,
  panelId,
  updateConfig,
}: {
  config: ReplayPanelConfig;
  panelId: string;
  updateConfig: (next: Partial<ReplayPanelConfig>) => void;
}) {
  const [api, setApi] = useState<ChartViewApi | null>(null);
  const pageTheme = usePageTheme();

  const symbol = config.symbol ?? "DEMO";
  const resampleMinutes = intervalMinutes(config.interval);

  // Synthetic demo walk — one per symbol (shared seed with ChartPanel).
  const staticData = useMemo<RawBar[]>(
    () => generateBars(375, SYMBOL_PRICE[symbol] ?? 100, SESSION_START),
    [symbol],
  );
  const session = useMemo(() => buildSession(staticData), [staticData]);
  const jumps = useMemo(() => buildJumps(session.start, session.end), [session]);

  const [replay, setReplay] = useState<ReplayController | null>(null);
  const apiRef = useRef<ChartViewApi | null>(null);
  const rcRef = useRef<ReplayController | null>(null);
  const tfRef = useRef(resampleMinutes);
  tfRef.current = resampleMinutes;

  const onReady = useCallback((chartApi: ChartViewApi) => {
    apiRef.current = chartApi;
    setApi(chartApi);
  }, []);

  // Push bars up to the replay cursor (resampled to the active TF) into the pane.
  const renderReplayBars = useCallback(() => {
    const rc = rcRef.current;
    const a = apiRef.current;
    if (!rc || !a || rc.getState().status !== "ready") return;
    const raw = rc.getBarsUpToCursor(symbol, "1m");
    const m = tfRef.current;
    a.controller.setData(m > 1 ? resample(raw as readonly RawBar[], m) : raw);
  }, [symbol]);

  // Replay lifecycle — always on. Boots a third of the way in so a single Play
  // visibly streams the rest of the session.
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const rc = createReplayController();
    rcRef.current = rc;
    const unsub = rc.subscribe((s) => {
      if (s.status === "ready") renderReplayBars();
    });
    rc.load({
      id: `${panelId}-${session.date}`,
      series: [{ symbol, interval: "1m" }],
      start: session.start,
      end: session.end,
      source: session.source,
    }).then(() => {
      if (cancelled) return;
      rc.seek(session.start + Math.round((session.end - session.start) / 3));
      setReplay(rc);
    });
    return () => {
      cancelled = true;
      unsub();
      rc.unload();
      rcRef.current = null;
      setReplay(null);
    };
  }, [api, panelId, symbol, session, renderReplayBars]);

  // Re-render replay bars when the timeframe changes.
  useEffect(() => {
    renderReplayBars();
  }, [resampleMinutes, renderReplayBars]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ChartView
        data={NO_DATA}
        resampleMinutes={resampleMinutes}
        seriesType={config.seriesType ?? "candlestick"}
        theme={config.theme ?? pageTheme}
        onReady={onReady}
      >
        {/* Control pill: instrument · timeframe · session date · REPLAY badge.
            Mirrors the ChartPanel pill, minus the drawing/indicator controls —
            this pane is a dedicated replay surface. */}
        <div style={S.controlPill}>
          <span style={S.pillSymbol}>{symbol}</span>
          <select
            value={config.interval ?? "1m"}
            onChange={(e) => updateConfig({ interval: e.target.value })}
            style={S.pillSelect}
            title="Timeframe"
          >
            {PANEL_INTERVALS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <span style={S.pillDate} title="Session date">{session.date}</span>
          <span style={S.pillReplay}>REPLAY</span>
        </div>
      </ChartView>

      {replay && (
        <div style={S.replayDock}>
          <ReplayControls controller={replay} formatTime={fmtClock} jumps={jumps} />
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  controlPill: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
    height: 26,
    padding: "0 6px",
    fontSize: 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "var(--app-fg)",
    background: "color-mix(in srgb, var(--app-panel) 80%, transparent)",
    border: "1px solid color-mix(in srgb, var(--app-border) 60%, transparent)",
    borderRadius: 6,
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
  },
  pillSymbol: { fontWeight: 600 },
  pillSelect: {
    height: 20,
    fontSize: 11,
    fontFamily: "inherit",
    color: "var(--app-fg)",
    background: "transparent",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: "0 2px",
    cursor: "pointer",
  },
  pillDate: {
    fontSize: 10,
    color: "var(--app-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  pillReplay: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--ck-warn, #f5a524)",
  },
  replayDock: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 340,
    maxWidth: "calc(100% - 16px)",
    zIndex: 10,
  },
};
