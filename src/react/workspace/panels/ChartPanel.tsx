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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChartView,
  DrawingToolbar,
  IndicatorPicker,
  MeasurementOverlay,
  type ChartViewApi,
  type SeriesType,
  IndicatorController,
  createBuiltinRegistry,
} from "../../index";
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
  theme: "dark",
};

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

  // Built-in indicator catalog.
  const indicators = useMemo(() => {
    const ctl = new IndicatorController(createBuiltinRegistry());
    ctl.add("EMA", { length: 21 });
    return ctl;
  }, []);

  const drawingOpts = useMemo(() => ({ storageKey: `candlekit:workspace:drawings:${panelId}` }), [panelId]);

  const onReady = useCallback((chartApi: ChartViewApi) => {
    setApi(chartApi);
  }, []);

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
        data={[]}
        seriesType={config.seriesType ?? "candlestick"}
        theme={config.theme ?? "dark"}
        drawing={drawingOpts}
        measurement
        indicators={indicators}
        onReady={onReady}
      >
        <DrawingToolbar />
        <IndicatorPicker />
        <MeasurementOverlay />
      </ChartView>
      {groupId && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            fontSize: 10,
            color: "var(--app-muted)",
            background: "var(--app-panel)",
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid var(--app-border)",
            zIndex: 10,
          }}
        >
          group {groupId}
        </div>
      )}
    </div>
  );
}

// ── Shared sync engine singleton (per page) ──────────────────────────────────

let sharedSyncEngine: SyncEngineImpl | null = null;

function getOrCreateSyncEngine(): SyncEngineImpl {
  if (!sharedSyncEngine) {
    sharedSyncEngine = new SyncEngineImpl();
  }
  return sharedSyncEngine;
}
