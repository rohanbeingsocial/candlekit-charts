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
  DrawingToolbar,
  IndicatorPicker,
  MeasurementOverlay,
  ReplayControls,
  createReplayController,
  resample,
  toBars,
  type ChartViewApi,
  type SeriesType,
  type ReplayController,
  type ReplayDataSource,
  IndicatorController,
  usePageTheme,
} from "../../index";
import { getWorkspaceIndicatorRegistry } from "./indicatorRegistry";
import { generateBars, type RawBar } from "../../../core/data";
import { SyncEngineImpl } from "../../../sync/SyncEngine";
import type { SyncEvent, SyncMember } from "../../../sync/types";
import type { PanelInstance } from "../../../workspace";
import { PanelContext } from "./PanelContext";

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

/** Per-symbol seed price so each chart tab renders a distinct synthetic walk. */
const SYMBOL_PRICE: Record<string, number> = {
  DEMO: 100,
  BTC: 42000,
  ETH: 2300,
  SOL: 110,
};

/** Map an interval code like "5m" / "1h" to resample minutes (1 = as-is). */
function intervalMinutes(code?: string): number {
  if (!code) return 1;
  const m = /^(\d+)\s*(m|h)$/i.exec(code.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  return m[2].toLowerCase() === "h" ? n * 60 : n;
}

// ── Per-pane replay ──────────────────────────────────────────────────────────
// Replay belongs to the chart pane (not a separate page/window): each pane can
// scrub its own session via the ReplayControls dock. Off by default so the
// default (synced) layout stays clean; toggled on per pane from the pane bar.

/** Synthetic intraday session anchor (fake-UTC ms — the IST-as-UTC convention). */
const SESSION_START = Date.UTC(2024, 0, 2, 9, 30);

/** Stable empty array — feeding this as ChartView `data` hands the pane to the
 *  replay controller without an inline `[]` refiring setData each render. */
const NO_DATA: RawBar[] = [];

/** Build a day-addressable replay source over a pane's synthetic bars. */
function buildSession(rawBars: RawBar[]): {
  source: ReplayDataSource;
  date: string;
  start: number;
  end: number;
} {
  const bars = toBars(rawBars);
  const date = new Date(SESSION_START).toISOString().slice(0, 10);
  const end = bars.length ? bars[bars.length - 1].ts : SESSION_START;
  const source: ReplayDataSource = {
    async fetchDay(_s, _i, d) {
      return d === date ? bars : [];
    },
    async listDatesBefore() {
      return [];
    },
    async listDatesAfter() {
      return [];
    },
  };
  return { source, date, start: SESSION_START, end };
}

/** Quick-jump markers (open · +1h… · close) for the replay transport. */
function buildJumps(start: number, end: number): { label: string; ts: number }[] {
  const out = [{ label: "Open", ts: start }];
  for (let h = 1; h <= 5; h++) {
    const ts = start + h * 60 * 60_000;
    if (ts < end) out.push({ label: `+${h}h`, ts });
  }
  out.push({ label: "Close", ts: end });
  return out;
}

/** Fake-UTC ts → wall clock (matches the chart's IST-as-UTC convention). */
function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

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
      <ChartPanelInner config={config} groupId={groupId} panelId={instance.id} />
    </PanelContext.Provider>
  );
}

function ChartPanelInner({
  config,
  groupId,
  panelId,
}: {
  config: ChartPanelConfig;
  groupId?: string;
  panelId: string;
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

  const chartData = replayOn ? NO_DATA : staticData;

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
        {/* Indicators trigger docked into the chart toolbar (top-left column),
            not floating in its own corner — matches the host workspace, where
            the indicators control sits on the chart toolbar. */}
        <div style={S.toolDock}>
          <IndicatorPicker className="ck-ind ck-ind--docked" />
          <DrawingToolbar style={{ position: "static" }} />
        </div>
        <MeasurementOverlay />
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
  // Top-left dock holding the indicators trigger above the drawing toolbar, so
  // the two read as one chart toolbar instead of two floating corners.
  toolDock: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-start",
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
