/**
 * Shared synthetic replay-session helpers.
 *
 * Both the per-pane replay toggle (ChartPanel) and the standalone ReplayPanel
 * scrub the same kind of synthetic intraday session. These helpers build a
 * day-addressable ReplayDataSource over a pane's synthetic bars, the quick-jump
 * markers for the transport, and the IST-as-UTC clock formatter — kept in one
 * place so the two panels can't drift apart.
 */

import { toBars, type ReplayDataSource } from "../../index";
import type { RawBar } from "../../../core/data";

/** Synthetic intraday session anchor (fake-UTC ms — the IST-as-UTC convention). */
export const SESSION_START = Date.UTC(2024, 0, 2, 9, 30);

/** Stable empty array — feeding this as ChartView `data` hands the pane to the
 *  replay controller without an inline `[]` refiring setData each render. */
export const NO_DATA: RawBar[] = [];

/** Per-symbol seed price so each chart renders a distinct synthetic walk. */
export const SYMBOL_PRICE: Record<string, number> = {
  DEMO: 100,
  BTC: 42000,
  ETH: 2300,
  SOL: 110,
};

/** Map an interval code like "5m" / "1h" to resample minutes (1 = as-is). */
export function intervalMinutes(code?: string): number {
  if (!code) return 1;
  const m = /^(\d+)\s*(m|h)$/i.exec(code.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  return m[2].toLowerCase() === "h" ? n * 60 : n;
}

/** Build a day-addressable replay source over a pane's synthetic bars. */
export function buildSession(rawBars: RawBar[]): {
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
export function buildJumps(start: number, end: number): { label: string; ts: number }[] {
  const out = [{ label: "Open", ts: start }];
  for (let h = 1; h <= 5; h++) {
    const ts = start + h * 60 * 60_000;
    if (ts < end) out.push({ label: `+${h}h`, ts });
  }
  out.push({ label: "Close", ts: end });
  return out;
}

/** Fake-UTC ts → wall clock (matches the chart's IST-as-UTC convention). */
export function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
