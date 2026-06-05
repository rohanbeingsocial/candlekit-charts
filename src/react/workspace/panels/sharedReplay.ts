/**
 * Shared workspace replay controller.
 *
 * Mirrors the trading-dashboard's host-level replay model: ONE controller per
 * page that the Replay panel drives (load / play / scrub) and every ChartPanel
 * follows by reading cursor-sliced bars. The Replay panel is a pure transport
 * surface — the chart panes are the replay surface. Built as a lazy page
 * singleton, like the shared sync engine.
 */

import {
  createReplayController,
  toBars,
  type ReplayController,
  type ReplayDataSource,
  type ReplaySeriesSpec,
  type Bar,
} from "../../index";
import { generateBars } from "../../../core/data";
import { SESSION_START, SYMBOL_PRICE } from "./replaySession";

let shared: ReplayController | null = null;

/** Lazy page-singleton replay controller shared by the Replay panel + charts. */
export function getSharedReplay(): ReplayController {
  if (!shared) shared = createReplayController();
  return shared;
}

export interface SharedSession {
  source: ReplayDataSource;
  series: ReplaySeriesSpec[];
  date: string;
  start: number;
  end: number;
}

/**
 * Build a multi-symbol synthetic session so a chart of any demo symbol can
 * follow the same shared cursor. One synthetic walk per symbol, all sharing the
 * session day; `fetchDay` returns the per-symbol bars.
 */
export function buildSharedSession(symbols: readonly string[]): SharedSession {
  const date = new Date(SESSION_START).toISOString().slice(0, 10);
  const bySymbol = new Map<string, Bar[]>();
  let end = SESSION_START;
  for (const sym of symbols) {
    const bars = toBars(generateBars(375, SYMBOL_PRICE[sym] ?? 100, SESSION_START));
    bySymbol.set(sym, bars);
    if (bars.length) end = Math.max(end, bars[bars.length - 1].ts);
  }
  const source: ReplayDataSource = {
    async fetchDay(sym, _interval, d) {
      return d === date ? (bySymbol.get(sym) ?? []) : [];
    },
    async listDatesBefore() {
      return [];
    },
    async listDatesAfter() {
      return [];
    },
  };
  return {
    source,
    series: symbols.map((symbol) => ({ symbol, interval: "1m" })),
    date,
    start: SESSION_START,
    end,
  };
}
