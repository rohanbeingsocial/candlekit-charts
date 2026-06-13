/**
 * ChartPanel — workspace panel that hosts a candlekit ChartView.
 *
 * Supports:
 *   - independent chart instances
 *   - synced chart groups (via SyncEngine)
 *   - drawing, indicators, measurement, replay
 *
 * Config shape:
 *   { symbol: string; interval: string; seriesType?: SeriesType; groupId?: string }
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChartView,
  CrosshairLegend,
  DrawingToolbar,
  IndicatorPicker,
  MeasurementOverlay,
  ReplayControls,
  createReplayController,
  resample,
  type ChartViewApi,
  type SeriesType,
  type ReplayController,
  type ReplayState,
  IndicatorController,
  usePageTheme,
} from "../../index";
import { getWorkspaceIndicatorRegistry } from "./indicatorRegistry";
import { generateBars, type RawBar } from "../../../core/data";
import { SyncEngineImpl } from "../../../sync/SyncEngine";
import type { SyncEvent, SyncMember } from "../../../sync/types";
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
import { getSharedReplay } from "./sharedReplay";

export interface ChartPanelConfig {
  symbol?: string;
  interval?: string;
  seriesType?: SeriesType;
  groupId?: string;
  theme?: "dark" | "light";
}

export const DEFAULT_CHART_CONFIG: ChartPanelConfig = {
  symbol: "DEMO",
  interval: "1m",
  seriesType: "candlestick",
  // No `theme` default: the panel follows the page theme (usePageTheme) unless a
  // config explicitly overrides it, so a global light/dark toggle reaches the
  // chart canvas without per-panel config plumbing.
};

// ── Per-pane replay ──────────────────────────────────────────────────────────
// Replay belongs to the chart pane (not a separate page/window): each pane can
// scrub its own session via the ReplayControls dock. Off by default so the
// default (synced) layout stays clean; toggled on per pane from the pane bar.
// The standalone ReplayPanel reuses the same synthetic-session helpers (see
// ./replaySession) so a per-pane scrub and a dedicated replay tab stay in sync.

export function ChartPanel({
  instance,
  updateConfig,
}: {
  instance: PanelInstance<ChartPanelConfig>;
  updateConfig: (next: Partial<ChartPanelConfig>) => void;
}) {
  const config = { ...DEFAULT_CHART_CONFIG, ...instance.config };
  const groupId = instance.groupId ?? config.groupId;

  return (
    <PanelContext.Provider value={{ instance, updateConfig }}>
      <ChartPanelInner config={config} groupId={groupId} panelId={instance.id} updateConfig={updateConfig} />
    </PanelContext.Provider>
  );
}

/** Instruments selectable from the chart's control pill (synthetic demo walks). */
const PANEL_SYMBOLS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "DEMO", label: "DEMO" },
  { id: "BTC", label: "BTC" },
  { id: "ETH", label: "ETH" },
  { id: "SOL", label: "SOL" },
];

/** Timeframes offered in the control pill (parity with the host TF dropdown). */
const PANEL_INTERVALS: readonly string[] = ["1m", "5m", "15m", "30m", "1h", "4h"];

function ChartPanelInner({
  config,
  groupId,
  panelId,
  updateConfig,
}: {
  config: ChartPanelConfig;
  groupId?: string;
  panelId: string;
  updateConfig: (next: Partial<ChartPanelConfig>) => void;
}) {
  const [api, setApi] = useState<ChartViewApi | null>(null);
  const applyingRef = useRef(false);
  const pageTheme = usePageTheme();

  // Indicator catalog — shared workspace registry (built-ins by default; a host
  // can swap in the full indicators-tv set via setWorkspaceIndicatorRegistry).
  const indicators = useMemo(() => {
    const ctl = new IndicatorController(getWorkspaceIndicatorRegistry());
    ctl.add("EMA", { length: 21 });
    return ctl;
  }, []);

  const drawingOpts = useMemo(() => ({ storageKey: `candlekit:workspace:drawings:${panelId}` }), [panelId]);

  const symbol = config.symbol ?? "DEMO";
  const resampleMinutes = intervalMinutes(config.interval);

  // Synthetic demo data — one random walk per symbol. A real consumer would
  // swap this for a data source / fetched bars via panel config.
  const staticData = useMemo<RawBar[]>(
    () => generateBars(375, SYMBOL_PRICE[symbol] ?? 100, SESSION_START),
    [symbol],
  );
  const session = useMemo(() => buildSession(staticData), [staticData]);
  const jumps = useMemo(() => buildJumps(session.start, session.end), [session]);

  // Per-pane replay state. While on, the controller drives the bars (ChartView
  // gets NO_DATA); off restores the static walk through ChartView's own pipeline.
  const [replayOn, setReplayOn] = useState(false);
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

  // Replay lifecycle — created on toggle-on, torn down on toggle-off/unmount.
  useEffect(() => {
    if (!api || !replayOn) return;
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
      rc.seek(session.end); // full session first; scrub back to replay
      setReplay(rc);
    });
    return () => {
      cancelled = true;
      unsub();
      rc.unload();
      rcRef.current = null;
      setReplay(null);
    };
  }, [api, replayOn, panelId, symbol, session, renderReplayBars]);

  // Re-render replay bars when the timeframe changes while replay is active.
  useEffect(() => {
    if (replayOn) renderReplayBars();
  }, [resampleMinutes, replayOn, renderReplayBars]);

  // ── Follow the SHARED replay (the workspace Replay panel) ────────────────────
  // When the Replay panel loads a session, every chart follows that one
  // controller's cursor — same model as the dashboard's host.replay. A pane's
  // own per-pane replay (replayOn) takes precedence; otherwise it follows shared.
  const shared = getSharedReplay();
  const [sharedState, setSharedState] = useState<ReplayState>(() => shared.getState());
  useEffect(() => shared.subscribe(setSharedState), [shared]);
  const followShared = !replayOn && sharedState.status === "ready";

  // Slice the shared controller's bars up to the cursor into this pane.
  const renderSharedBars = useCallback(() => {
    const a = apiRef.current;
    if (!a || shared.getState().status !== "ready") return;
    const raw = shared.getBarsUpToCursor(symbol, "1m");
    const m = tfRef.current;
    a.controller.setData(m > 1 ? resample(raw as readonly RawBar[], m) : raw);
  }, [shared, symbol]);

  // Materialize this pane's series on the shared controller, then render. The
  // controller short-circuits ensureSeries when the key already exists; each
  // controller notify (cursor tick, series add) re-runs this effect.
  useEffect(() => {
    if (!api || !followShared || sharedState.status !== "ready") return;
    const hasIt = sharedState.activeSeries.some((s) => s.symbol === symbol && s.interval === "1m");
    if (!hasIt) {
      void shared.ensureSeries(symbol, "1m");
      return;
    }
    renderSharedBars();
  }, [api, followShared, sharedState, shared, symbol, renderSharedBars]);

  // Re-slice when the timeframe changes while following the shared session.
  useEffect(() => {
    if (followShared) renderSharedBars();
  }, [resampleMinutes, followShared, renderSharedBars]);

  const chartData = replayOn || followShared ? NO_DATA : staticData;

  // Sync group attachment.
  useEffect(() => {
    if (!api || !groupId) return;

    const sync = getOrCreateSyncEngine();
    if (!sync.getGroup(groupId)) {
      sync.createGroup({
        id: groupId,
        name: groupId,
        flags: new Set(["timeRange", "crosshair"]),
      });
    }

    const chart = api.controller.getChart();
    const series = api.controller.getSeries();
    const ts = chart.timeScale();

    const member: SyncMember = {
      panelId,
      viewport: {
        getVisibleLogicalRange: () => {
          const r = ts.getVisibleLogicalRange();
          return r ? { from: r.from, to: r.to } : null;
        },
        setVisibleLogicalRange: (r) => {
          ts.setVisibleLogicalRange(r);
        },
        setCrosshairAtTime: (tsMs) => {
          if (tsMs == null) {
            chart.clearCrosshairPosition();
            return;
          }
          // Crosshair sync is handled via price+y below for better accuracy.
        },
      },
      getSession: () => ({ symbol: config.symbol ?? "DEMO", interval: config.interval ?? "1m" }),
      apply: (event: SyncEvent) => {
        applyingRef.current = true;
        try {
          switch (event.kind) {
            case "timeRange": {
              ts.setVisibleLogicalRange({ from: event.from, to: event.to });
              break;
            }
            case "crosshair": {
              if (event.ts == null || event.y == null) {
                chart.clearCrosshairPosition();
                break;
              }
              const price = series.coordinateToPrice(event.y);
              if (price == null) break;
              chart.setCrosshairPosition(price, Math.floor(event.ts / 1000) as never, series);
              break;
            }
            default:
              break;
          }
        } finally {
          applyingRef.current = false;
        }
      },
    };

    const detach = sync.attach(groupId, member);

    const broadcastRange = (range: { from: number; to: number } | null) => {
      if (applyingRef.current || !range) return;
      sync.broadcast(groupId, {
        kind: "timeRange",
        from: range.from,
        to: range.to,
        sourcePanelId: panelId,
      });
    };
    ts.subscribeVisibleLogicalRangeChange(broadcastRange);

    const broadcastCross = (params: {
      time?: unknown;
      point?: { x: number; y: number };
      seriesData?: { size: number };
    }) => {
      if (applyingRef.current) return;
      const noSeries = !params.seriesData || params.seriesData.size === 0;
      if (params.time == null || noSeries || !params.point) {
        sync.broadcast(groupId, { kind: "crosshair", ts: null, y: null, sourcePanelId: panelId });
        return;
      }
      const tsec = Number(params.time) * 1000;
      sync.broadcast(groupId, {
        kind: "crosshair",
        ts: tsec,
        y: params.point.y,
        sourcePanelId: panelId,
      });
    };
    chart.subscribeCrosshairMove(broadcastCross as never);

    return () => {
      detach();
      ts.unsubscribeVisibleLogicalRangeChange(broadcastRange);
      chart.unsubscribeCrosshairMove(broadcastCross as never);
    };
  }, [api, groupId, panelId, config.symbol, config.interval]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ChartView
        data={chartData}
        resampleMinutes={resampleMinutes}
        seriesType={config.seriesType ?? "candlestick"}
        theme={config.theme ?? pageTheme}
        drawing={drawingOpts}
        measurement
        indicators={indicators}
        onReady={onReady}
      >
        {/* Flush-left vertical drawing toolbar (pinned by .ck-toolbar) — matches
            the host trading-dashboard sidebar. */}
        <DrawingToolbar />

        {/* Control pill, offset right of the toolbar: instrument · timeframe ·
            indicators · trade date · replay status. Mirrors the host chart pane
            header, which carries the same controls in one mono pill. */}
        <div style={S.controlPill}>
          <select
            value={symbol}
            onChange={(e) => updateConfig({ symbol: e.target.value })}
            style={{ ...S.pillSelect, fontWeight: 600 }}
            disabled={replayOn}
            title={replayOn ? "Symbol locked during replay" : "Instrument"}
          >
            {!PANEL_SYMBOLS.some((s) => s.id === symbol) && <option value={symbol}>{symbol}</option>}
            {PANEL_SYMBOLS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
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
          <IndicatorPicker className="ck-ind ck-ind--docked" />
          <span style={S.pillDate} title="Session date">{session.date}</span>
          {replayOn && <span style={S.pillReplay}>REPLAY</span>}
        </div>
        <MeasurementOverlay />
        <CrosshairLegend style={{ top: 38, left: 44 }} />
      </ChartView>

      {/* Pane bar: replay toggle (+ sync-group badge). Replay attaches to the
          chart pane — not a separate page. */}
      <div style={S.paneBar}>
        {groupId && <span style={S.groupBadge}>group {groupId}</span>}
        <button
          type="button"
          onClick={() => setReplayOn((v) => !v)}
          style={replayOn ? { ...S.paneBtn, ...S.paneBtnActive } : S.paneBtn}
          title="Replay this chart"
        >
          {replayOn ? "■ Replay" : "▶ Replay"}
        </button>
      </div>

      {replayOn && replay && (
        <div style={S.replayDock}>
          <ReplayControls controller={replay} formatTime={fmtClock} jumps={jumps} />
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  // Control pill, pinned just right of the 36px flush-left drawing toolbar.
  // One mono row: instrument · timeframe · indicators · date · replay status.
  controlPill: {
    position: "absolute",
    top: 8,
    left: 44,
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
  paneBar: {
    position: "absolute",
    top: 4,
    right: 4,
    display: "flex",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  groupBadge: {
    fontSize: 10,
    color: "var(--app-muted)",
    background: "var(--app-panel)",
    padding: "2px 6px",
    borderRadius: 4,
    border: "1px solid var(--app-border)",
  },
  paneBtn: {
    height: 22,
    padding: "0 8px",
    fontSize: 11,
    fontFamily: "inherit",
    color: "var(--app-fg)",
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    cursor: "pointer",
  },
  paneBtnActive: {
    color: "var(--app-bg)",
    background: "var(--app-fg)",
    borderColor: "var(--app-fg)",
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

// ── Shared sync engine singleton (per page) ──────────────────────────────────

let sharedSyncEngine: SyncEngineImpl | null = null;

function getOrCreateSyncEngine(): SyncEngineImpl {
  if (!sharedSyncEngine) {
    sharedSyncEngine = new SyncEngineImpl();
  }
  return sharedSyncEngine;
}
