/**
 * ReplayPanel — workspace replay transport.
 *
 * A full-pane transport surface (no embedded chart): it loads a synthetic
 * session into the page's SHARED replay controller, then every ChartPanel in
 * the workspace follows that one cursor. Mirrors the trading-dashboard's replay
 * panel — pure transport, sized `height:100% / width:100%` so it fills and
 * resizes inside FlexLayout like any other pane. The chart panes are the replay
 * surface; this panel just drives them.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ReplayControls,
  type ReplayState,
  type ReplayManifest,
} from "../../index";
import type { PanelInstance } from "../../../workspace";
import { PanelContext } from "./PanelContext";
import { fmtClock, buildJumps } from "./replaySession";
import { getSharedReplay, buildSharedSession } from "./sharedReplay";

export interface ReplayPanelConfig {
  /** Symbols materialized into the shared session (charts of these follow). */
  symbols?: string[];
  /** Speed applied on load. */
  defaultSpeed?: number;
}

export const DEFAULT_REPLAY_CONFIG: ReplayPanelConfig = {
  symbols: ["DEMO", "BTC", "ETH", "SOL"],
  defaultSpeed: 8,
};

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
      <ReplayPanelInner
        symbols={config.symbols ?? DEFAULT_REPLAY_CONFIG.symbols!}
        defaultSpeed={config.defaultSpeed ?? 1}
      />
    </PanelContext.Provider>
  );
}

function ReplayPanelInner({
  symbols,
  defaultSpeed,
}: {
  symbols: string[];
  defaultSpeed: number;
}) {
  const shared = getSharedReplay();
  const [state, setState] = useState<ReplayState>(() => shared.getState());
  useEffect(() => shared.subscribe(setState), [shared]);

  const session = useMemo(() => buildSharedSession(symbols), [symbols]);
  const jumps = useMemo(() => buildJumps(session.start, session.end), [session]);

  const isReady = state.status === "ready";
  const isLoading = state.status === "loading";

  const load = useCallback(async () => {
    const manifest: ReplayManifest = {
      id: `workspace-${session.date}-${Date.now()}`,
      series: session.series,
      start: session.start,
      end: session.end,
      source: session.source,
    };
    await shared.load(manifest);
    // Boot a third of the way in so a single Play visibly streams the rest into
    // every following chart.
    shared.seek(session.start + Math.round((session.end - session.start) / 3));
    if (defaultSpeed !== 1) shared.setSpeed(defaultSpeed);
  }, [shared, session, defaultSpeed]);

  const unload = useCallback(() => shared.unload(), [shared]);

  return (
    <div style={S.root}>
      <div style={S.bar}>
        <span style={S.title}>Replay</span>
        <span style={S.date}>{session.date}</span>
        {isReady ? (
          <button type="button" style={S.btn} onClick={unload}>
            Unload
          </button>
        ) : (
          <button type="button" style={S.btn} onClick={() => void load()} disabled={isLoading}>
            {isLoading ? "Loading…" : "Load session"}
          </button>
        )}
      </div>

      {isReady ? (
        <ReplayControls controller={shared} formatTime={fmtClock} jumps={jumps} />
      ) : (
        <div style={S.empty}>
          {isLoading
            ? "Materializing session…"
            : "Load a session — every chart pane in this workspace then follows the replay cursor. Play / pause / step / scrub / jump from here."}
        </div>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  root: {
    height: "100%",
    width: "100%",
    overflow: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 12,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    color: "var(--app-fg)",
    background: "var(--app-bg)",
  },
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontSize: 11,
    color: "var(--app-muted)",
  },
  date: {
    fontVariantNumeric: "tabular-nums",
    color: "var(--app-muted)",
  },
  btn: {
    marginLeft: "auto",
    height: 24,
    padding: "0 10px",
    fontSize: 11,
    fontFamily: "inherit",
    color: "var(--app-fg)",
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    cursor: "pointer",
  },
  empty: {
    border: "1px dashed var(--app-border)",
    borderRadius: 6,
    padding: 12,
    color: "var(--app-muted)",
    lineHeight: 1.5,
  },
};
