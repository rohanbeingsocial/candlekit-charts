/**
 * Built-in indicator catalog — original MIT implementations, no third-party
 * runtime. Pure functions over {@link IndicatorBar}[] producing
 * {@link IndicatorResult}. Register them with {@link createBuiltinRegistry} or
 * pick individual defs from {@link BUILTIN_INDICATORS}.
 *
 * Included: SMA, EMA, WMA, VWAP, Bollinger Bands, RSI, MACD, ATR, Stochastic.
 * Add your own via `registry.register(def)` — same shape.
 */

import { IndicatorRegistry } from "./registry";
import type { IndicatorBar, IndicatorDef, PlotPoint } from "./types";

// ── math helpers (operate on plain number[]; null = warmup/undefined) ──────────

type Series = Array<number | null>;

function smaSeries(values: number[], len: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (len <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= len) sum -= values[i - len];
    if (i >= len - 1) out[i] = sum / len;
  }
  return out;
}

function emaSeries(values: number[], len: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (len <= 0 || values.length < len) return out;
  const k = 2 / (len + 1);
  // Seed with SMA of the first `len` values.
  let seed = 0;
  for (let i = 0; i < len; i++) seed += values[i];
  let prev = seed / len;
  out[len - 1] = prev;
  for (let i = len; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function wmaSeries(values: number[], len: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (len <= 0) return out;
  const denom = (len * (len + 1)) / 2;
  for (let i = len - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < len; j++) acc += values[i - j] * (len - j);
    out[i] = acc / denom;
  }
  return out;
}

/** Wilder's RMA (used by RSI/ATR). */
function rmaSeries(values: number[], len: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (len <= 0 || values.length < len) return out;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += values[i];
  let prev = sum / len;
  out[len - 1] = prev;
  for (let i = len; i < values.length; i++) {
    prev = (prev * (len - 1) + values[i]) / len;
    out[i] = prev;
  }
  return out;
}

function stdevSeries(values: number[], len: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (len <= 0) return out;
  for (let i = len - 1; i < values.length; i++) {
    let mean = 0;
    for (let j = 0; j < len; j++) mean += values[i - j];
    mean /= len;
    let varSum = 0;
    for (let j = 0; j < len; j++) {
      const d = values[i - j] - mean;
      varSum += d * d;
    }
    out[i] = Math.sqrt(varSum / len);
  }
  return out;
}

/** Pair a value series back to bar timestamps, dropping warmup nulls. */
function toPoints(bars: IndicatorBar[], series: Series): PlotPoint[] {
  const pts: PlotPoint[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = series[i];
    if (v != null && Number.isFinite(v)) pts.push({ time: bars[i].time, value: v });
  }
  return pts;
}

const closes = (b: IndicatorBar[]) => b.map((x) => x.close);
const int = (inputs: Record<string, unknown> | undefined, key: string, def: number) => {
  const v = Number(inputs?.[key]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : def;
};
const num = (inputs: Record<string, unknown> | undefined, key: string, def: number) => {
  const v = Number(inputs?.[key]);
  return Number.isFinite(v) ? v : def;
};

// ── indicator definitions ──────────────────────────────────────────────────────

const SMA: IndicatorDef = {
  name: "SMA",
  title: "Simple Moving Average",
  shortTitle: "SMA",
  category: "overlay",
  defaultInputs: { length: 20 },
  inputConfig: [{ name: "length", type: "int", defval: 20, title: "Length" }],
  plotConfig: [{ id: "sma", title: "SMA", color: "#2962ff", lineWidth: 2 }],
  hlineConfig: [],
  calculate: (bars, inputs) => ({ plots: { sma: toPoints(bars, smaSeries(closes(bars), int(inputs, "length", 20))) } }),
};

const EMA: IndicatorDef = {
  name: "EMA",
  title: "Exponential Moving Average",
  shortTitle: "EMA",
  category: "overlay",
  defaultInputs: { length: 20 },
  inputConfig: [{ name: "length", type: "int", defval: 20, title: "Length" }],
  plotConfig: [{ id: "ema", title: "EMA", color: "#ff9800", lineWidth: 2 }],
  hlineConfig: [],
  calculate: (bars, inputs) => ({ plots: { ema: toPoints(bars, emaSeries(closes(bars), int(inputs, "length", 20))) } }),
};

const WMA: IndicatorDef = {
  name: "WMA",
  title: "Weighted Moving Average",
  shortTitle: "WMA",
  category: "overlay",
  defaultInputs: { length: 20 },
  inputConfig: [{ name: "length", type: "int", defval: 20, title: "Length" }],
  plotConfig: [{ id: "wma", title: "WMA", color: "#26a69a", lineWidth: 2 }],
  hlineConfig: [],
  calculate: (bars, inputs) => ({ plots: { wma: toPoints(bars, wmaSeries(closes(bars), int(inputs, "length", 20))) } }),
};

const VWAP: IndicatorDef = {
  name: "VWAP",
  title: "Volume Weighted Average Price",
  shortTitle: "VWAP",
  category: "overlay",
  defaultInputs: {},
  inputConfig: [],
  plotConfig: [{ id: "vwap", title: "VWAP", color: "#ab47bc", lineWidth: 2 }],
  hlineConfig: [],
  calculate: (bars) => {
    let pv = 0;
    let vol = 0;
    const series: Series = bars.map((b) => {
      const typical = (b.high + b.low + b.close) / 3;
      pv += typical * (b.volume || 0);
      vol += b.volume || 0;
      return vol > 0 ? pv / vol : typical;
    });
    return { plots: { vwap: toPoints(bars, series) } };
  },
};

const Bollinger: IndicatorDef = {
  name: "Bollinger",
  title: "Bollinger Bands",
  shortTitle: "BB",
  category: "overlay",
  defaultInputs: { length: 20, mult: 2 },
  inputConfig: [
    { name: "length", type: "int", defval: 20, title: "Length" },
    { name: "mult", type: "float", defval: 2, title: "StdDev" },
  ],
  plotConfig: [
    { id: "upper", title: "Upper", color: "#787b86", lineWidth: 1 },
    { id: "basis", title: "Basis", color: "#2962ff", lineWidth: 1 },
    { id: "lower", title: "Lower", color: "#787b86", lineWidth: 1 },
  ],
  hlineConfig: [],
  calculate: (bars, inputs) => {
    const len = int(inputs, "length", 20);
    const mult = num(inputs, "mult", 2);
    const c = closes(bars);
    const basis = smaSeries(c, len);
    const sd = stdevSeries(c, len);
    const upper: Series = basis.map((b, i) => (b != null && sd[i] != null ? b + mult * (sd[i] as number) : null));
    const lower: Series = basis.map((b, i) => (b != null && sd[i] != null ? b - mult * (sd[i] as number) : null));
    return {
      plots: {
        upper: toPoints(bars, upper),
        basis: toPoints(bars, basis),
        lower: toPoints(bars, lower),
      },
    };
  },
};

const RSI: IndicatorDef = {
  name: "RSI",
  title: "Relative Strength Index",
  shortTitle: "RSI",
  category: "oscillator",
  defaultInputs: { length: 14 },
  inputConfig: [{ name: "length", type: "int", defval: 14, title: "Length" }],
  plotConfig: [{ id: "rsi", title: "RSI", color: "#7e57c2", lineWidth: 2 }],
  hlineConfig: [
    { price: 70, color: "#787b86", linestyle: "dashed", title: "70" },
    { price: 30, color: "#787b86", linestyle: "dashed", title: "30" },
  ],
  calculate: (bars, inputs) => {
    const len = int(inputs, "length", 14);
    const c = closes(bars);
    const gains: number[] = [0];
    const losses: number[] = [0];
    for (let i = 1; i < c.length; i++) {
      const ch = c[i] - c[i - 1];
      gains.push(Math.max(0, ch));
      losses.push(Math.max(0, -ch));
    }
    const avgGain = rmaSeries(gains, len);
    const avgLoss = rmaSeries(losses, len);
    const rsi: Series = c.map((_, i) => {
      const g = avgGain[i];
      const l = avgLoss[i];
      if (g == null || l == null) return null;
      if (l === 0) return 100;
      const rs = g / l;
      return 100 - 100 / (1 + rs);
    });
    return { plots: { rsi: toPoints(bars, rsi) } };
  },
};

const MACD: IndicatorDef = {
  name: "MACD",
  title: "MACD",
  shortTitle: "MACD",
  category: "oscillator",
  defaultInputs: { fast: 12, slow: 26, signal: 9 },
  inputConfig: [
    { name: "fast", type: "int", defval: 12, title: "Fast" },
    { name: "slow", type: "int", defval: 26, title: "Slow" },
    { name: "signal", type: "int", defval: 9, title: "Signal" },
  ],
  plotConfig: [
    { id: "hist", title: "Histogram", color: "#26a69a", style: "histogram" },
    { id: "macd", title: "MACD", color: "#2962ff", lineWidth: 2 },
    { id: "signal", title: "Signal", color: "#ff6d00", lineWidth: 2 },
  ],
  hlineConfig: [{ price: 0, color: "#787b86", linestyle: "dotted" }],
  calculate: (bars, inputs) => {
    const fast = int(inputs, "fast", 12);
    const slow = int(inputs, "slow", 26);
    const sig = int(inputs, "signal", 9);
    const c = closes(bars);
    const ef = emaSeries(c, fast);
    const es = emaSeries(c, slow);
    const macd: Series = c.map((_, i) => (ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null));
    // signal = EMA of the defined macd values; map back by index.
    const defined: number[] = [];
    const idxMap: number[] = [];
    macd.forEach((v, i) => {
      if (v != null) {
        defined.push(v);
        idxMap.push(i);
      }
    });
    const sigDefined = emaSeries(defined, sig);
    const signal: Series = new Array(c.length).fill(null);
    sigDefined.forEach((v, j) => {
      if (v != null) signal[idxMap[j]] = v;
    });
    const histPts: PlotPoint[] = [];
    for (let i = 0; i < c.length; i++) {
      if (macd[i] != null && signal[i] != null) {
        const h = (macd[i] as number) - (signal[i] as number);
        histPts.push({ time: bars[i].time, value: h, color: h >= 0 ? "#26a69a" : "#ef5350" });
      }
    }
    return { plots: { hist: histPts, macd: toPoints(bars, macd), signal: toPoints(bars, signal) } };
  },
};

const ATR: IndicatorDef = {
  name: "ATR",
  title: "Average True Range",
  shortTitle: "ATR",
  category: "oscillator",
  defaultInputs: { length: 14 },
  inputConfig: [{ name: "length", type: "int", defval: 14, title: "Length" }],
  plotConfig: [{ id: "atr", title: "ATR", color: "#ef6c00", lineWidth: 2 }],
  hlineConfig: [],
  calculate: (bars, inputs) => {
    const len = int(inputs, "length", 14);
    const tr: number[] = bars.map((b, i) => {
      if (i === 0) return b.high - b.low;
      const pc = bars[i - 1].close;
      return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    });
    return { plots: { atr: toPoints(bars, rmaSeries(tr, len)) } };
  },
};

const Stochastic: IndicatorDef = {
  name: "Stochastic",
  title: "Stochastic Oscillator",
  shortTitle: "Stoch",
  category: "oscillator",
  defaultInputs: { kLength: 14, dLength: 3 },
  inputConfig: [
    { name: "kLength", type: "int", defval: 14, title: "%K Length" },
    { name: "dLength", type: "int", defval: 3, title: "%D Smoothing" },
  ],
  plotConfig: [
    { id: "k", title: "%K", color: "#2962ff", lineWidth: 2 },
    { id: "d", title: "%D", color: "#ff6d00", lineWidth: 1 },
  ],
  hlineConfig: [
    { price: 80, color: "#787b86", linestyle: "dashed", title: "80" },
    { price: 20, color: "#787b86", linestyle: "dashed", title: "20" },
  ],
  calculate: (bars, inputs) => {
    const kLen = int(inputs, "kLength", 14);
    const dLen = int(inputs, "dLength", 3);
    const kRaw: number[] = new Array(bars.length).fill(NaN);
    for (let i = kLen - 1; i < bars.length; i++) {
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = 0; j < kLen; j++) {
        hi = Math.max(hi, bars[i - j].high);
        lo = Math.min(lo, bars[i - j].low);
      }
      kRaw[i] = hi === lo ? 50 : (100 * (bars[i].close - lo)) / (hi - lo);
    }
    const kSeries: Series = kRaw.map((v) => (Number.isNaN(v) ? null : v));
    // %D = SMA of defined %K.
    const kDefined: number[] = [];
    const idxMap: number[] = [];
    kSeries.forEach((v, i) => {
      if (v != null) {
        kDefined.push(v);
        idxMap.push(i);
      }
    });
    const dDefined = smaSeries(kDefined, dLen);
    const dSeries: Series = new Array(bars.length).fill(null);
    dDefined.forEach((v, j) => {
      if (v != null) dSeries[idxMap[j]] = v;
    });
    return { plots: { k: toPoints(bars, kSeries), d: toPoints(bars, dSeries) } };
  },
};

/** All built-in definitions, in display order. */
export const BUILTIN_INDICATORS: IndicatorDef[] = [
  SMA,
  EMA,
  WMA,
  VWAP,
  Bollinger,
  RSI,
  MACD,
  ATR,
  Stochastic,
];

/** A registry pre-populated with {@link BUILTIN_INDICATORS}. Extend with `.register`. */
export function createBuiltinRegistry(into?: IndicatorRegistry): IndicatorRegistry {
  const registry = into ?? new IndicatorRegistry();
  return registry.registerAll(BUILTIN_INDICATORS);
}
