/**
 * Deterministic replay controller. Per-(symbol, interval) per-day LRU cache with
 * backward prefetch on load and forward prefetch as the cursor nears the tail of
 * the current day. The tick loop advances the cursor one bar at a time, emitting
 * a {@link ReplayBarEvent} for each newly-visible bar.
 *
 * Ported from the application's replay engine; decoupled to read from a
 * {@link ReplayDataSource} you provide. `setTimeout` is used only to pace UI
 * emission — speed=N collapses pacing to ~`BASE_TICK_MS / N` per advance.
 */

import type { Bar, IntervalCode, SymbolId, Timestamp } from "../core/types";
import type {
  ReplayBarEvent,
  ReplayController,
  ReplayCursor,
  ReplayEngineOptions,
  ReplayManifest,
  ReplaySeriesSpec,
  ReplayState,
} from "./types";

const DEFAULT_OPTIONS: ReplayEngineOptions = {
  cacheDays: 8,
  prefetchBackwardDays: 2,
  prefetchForwardOnTailPct: 0.15,
};

const BASE_TICK_MS = 1000;

interface SeriesKey {
  symbol: SymbolId;
  interval: IntervalCode;
}

interface DayEntry {
  date: string;
  bars: Bar[];
  lru: number;
}

interface SeriesCache {
  days: Map<string, DayEntry>;
  /** Sorted ascending union of all cached days' bars. Rebuilt on insert. */
  flat: Bar[];
}

function seriesKey(k: SeriesKey): string {
  return `${k.symbol}|${k.interval}`;
}

function tsToDate(ts: Timestamp): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** First index whose ts >= target (binary search). */
function lowerBoundIndex(arr: Bar[], ts: Timestamp): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].ts < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export class ReplayControllerImpl implements ReplayController {
  private state: ReplayState = { status: "idle" };
  private subs = new Set<(s: ReplayState) => void>();
  private barSubs = new Set<(e: ReplayBarEvent) => void>();
  private caches = new Map<string, SeriesCache>();
  private lruCounter = 0;
  private nextSeq = 1;
  private tickHandle: ReturnType<typeof setTimeout> | null = null;
  private prefetchInflight = new Set<string>();
  private activeSeries: ReplaySeriesSpec[] = [];
  private dataVersion = 0;

  constructor(private readonly options: ReplayEngineOptions = DEFAULT_OPTIONS) {}

  getState(): ReplayState {
    return this.state;
  }

  subscribe(cb: (s: ReplayState) => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  onBar(cb: (e: ReplayBarEvent) => void): () => void {
    this.barSubs.add(cb);
    return () => this.barSubs.delete(cb);
  }

  async load(manifest: ReplayManifest): Promise<void> {
    this.cancelTick();
    this.caches.clear();
    this.nextSeq = 1;
    this.dataVersion = 0;
    this.activeSeries = manifest.series.map((s) => ({ symbol: s.symbol, interval: s.interval }));
    this.transition({ status: "loading", manifest });

    try {
      const startDate = tsToDate(manifest.start);

      await Promise.all(
        this.activeSeries.map(async (spec) => {
          await this.fetchAndCacheDay(manifest, spec, startDate);
          const before = await manifest.source.listDatesBefore(
            spec.symbol,
            spec.interval,
            startDate,
            this.options.prefetchBackwardDays,
          );
          await Promise.all(before.map((d) => this.fetchAndCacheDay(manifest, spec, d)));
        }),
      );

      const cursorTs = this.findInitialCursor(manifest);
      if (cursorTs == null) {
        this.transition({ status: "error", manifest, error: "No bars available in manifest range" });
        return;
      }

      const cursor: ReplayCursor = { ts: cursorTs, seq: this.nextSeq++ };
      this.transition({
        status: "ready",
        manifest,
        cursor,
        speed: 1,
        playing: false,
        window: this.computeWindow(),
        activeSeries: this.activeSeries.slice(),
        dataVersion: this.dataVersion,
      });
    } catch (err) {
      this.transition({
        status: "error",
        manifest,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async ensureSeries(symbol: SymbolId, interval: IntervalCode): Promise<void> {
    if (this.state.status !== "ready") return;
    const key = seriesKey({ symbol, interval });
    const already = this.activeSeries.some((s) => seriesKey(s) === key);
    const manifest = this.state.manifest;
    const cursorDate = tsToDate(this.state.cursor.ts);

    if (!already) this.activeSeries.push({ symbol, interval });

    await this.fetchAndCacheDay(manifest, { symbol, interval }, cursorDate);
    const before = await manifest.source.listDatesBefore(
      symbol,
      interval,
      cursorDate,
      this.options.prefetchBackwardDays,
    );
    await Promise.all(before.map((d) => this.fetchAndCacheDay(manifest, { symbol, interval }, d)));

    if (this.state.status !== "ready") return;
    this.dataVersion++;
    this.state = {
      ...this.state,
      activeSeries: this.activeSeries.slice(),
      window: this.computeWindow(),
      dataVersion: this.dataVersion,
    };
    this.notify();
  }

  unload(): void {
    this.cancelTick();
    this.caches.clear();
    this.activeSeries = [];
    this.dataVersion = 0;
    this.transition({ status: "idle" });
  }

  play(): void {
    if (this.state.status !== "ready" || this.state.playing) return;
    this.state = { ...this.state, playing: true };
    this.notify();
    this.scheduleTick();
  }

  pause(): void {
    if (this.state.status !== "ready" || !this.state.playing) return;
    this.cancelTick();
    this.state = { ...this.state, playing: false };
    this.notify();
  }

  step(direction: 1 | -1): void {
    if (this.state.status !== "ready") return;
    if (this.state.playing) this.pause();
    this.advanceCursor(direction);
  }

  seek(ts: Timestamp): void {
    if (this.state.status !== "ready") return;
    const wasPlaying = this.state.playing;
    if (wasPlaying) this.pause();

    void this.ensureDayCached(ts).then(() => {
      if (this.state.status !== "ready") return;
      const cursor: ReplayCursor = { ts, seq: this.nextSeq++ };
      this.state = { ...this.state, cursor, window: this.computeWindow() };
      this.notify();
      if (wasPlaying) this.play();
    });
  }

  setSpeed(multiplier: number): void {
    if (this.state.status !== "ready") return;
    const speed = Math.max(0.1, Math.min(64, multiplier));
    this.state = { ...this.state, speed };
    this.notify();
    if (this.state.playing) {
      this.cancelTick();
      this.scheduleTick();
    }
  }

  getBarsUpToCursor(symbol: SymbolId, interval: IntervalCode): readonly Bar[] {
    if (this.state.status !== "ready") return [];
    const cache = this.caches.get(seriesKey({ symbol, interval }));
    if (!cache) return [];
    const cursorTs = this.state.cursor.ts;
    const idx = lowerBoundIndex(cache.flat, cursorTs);
    let endExclusive = idx;
    if (endExclusive < cache.flat.length && cache.flat[endExclusive].ts === cursorTs) endExclusive += 1;
    return cache.flat.slice(0, endExclusive);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async fetchAndCacheDay(
    manifest: ReplayManifest,
    spec: SeriesKey,
    date: string,
  ): Promise<void> {
    const key = seriesKey(spec);
    const inflightKey = `${key}|${date}`;
    if (this.prefetchInflight.has(inflightKey)) return;
    let cache = this.caches.get(key);
    if (cache?.days.has(date)) {
      cache.days.get(date)!.lru = ++this.lruCounter;
      return;
    }
    this.prefetchInflight.add(inflightKey);
    try {
      const bars = await manifest.source.fetchDay(spec.symbol, spec.interval, date);
      cache = this.caches.get(key);
      if (!cache) {
        cache = { days: new Map(), flat: [] };
        this.caches.set(key, cache);
      }
      cache.days.set(date, {
        date,
        bars: bars.slice().sort((a, b) => a.ts - b.ts),
        lru: ++this.lruCounter,
      });
      this.evictLRU(cache);
      this.rebuildFlat(cache);
    } finally {
      this.prefetchInflight.delete(inflightKey);
    }
  }

  private evictLRU(cache: SeriesCache): void {
    const max = this.options.cacheDays;
    if (cache.days.size <= max) return;
    const entries = Array.from(cache.days.values()).sort((a, b) => a.lru - b.lru);
    const removeCount = cache.days.size - max;
    for (let i = 0; i < removeCount; i++) cache.days.delete(entries[i].date);
  }

  private rebuildFlat(cache: SeriesCache): void {
    const all: Bar[] = [];
    const dates = Array.from(cache.days.keys()).sort();
    for (const d of dates) all.push(...cache.days.get(d)!.bars);
    cache.flat = all;
  }

  private findInitialCursor(manifest: ReplayManifest): Timestamp | null {
    let best: Timestamp | null = null;
    for (const spec of this.activeSeries) {
      const cache = this.caches.get(seriesKey(spec));
      if (!cache) continue;
      const idx = lowerBoundIndex(cache.flat, manifest.start);
      const bar = cache.flat[idx] ?? cache.flat[cache.flat.length - 1];
      if (!bar) continue;
      if (best == null || bar.ts < best) best = bar.ts;
    }
    return best;
  }

  private computeWindow(): { from: Timestamp; to: Timestamp } {
    let from = Number.POSITIVE_INFINITY;
    let to = Number.NEGATIVE_INFINITY;
    for (const cache of this.caches.values()) {
      if (cache.flat.length === 0) continue;
      from = Math.min(from, cache.flat[0].ts);
      to = Math.max(to, cache.flat[cache.flat.length - 1].ts);
    }
    if (!isFinite(from) || !isFinite(to)) return { from: 0, to: 0 };
    return { from, to };
  }

  private scheduleTick(): void {
    if (this.state.status !== "ready" || !this.state.playing) return;
    const interval = Math.max(16, BASE_TICK_MS / this.state.speed);
    this.tickHandle = setTimeout(() => {
      this.tickHandle = null;
      const advanced = this.advanceCursor(1);
      if (advanced) this.scheduleTick();
      else if (this.state.status === "ready") {
        this.state = { ...this.state, playing: false };
        this.notify();
      }
    }, interval);
  }

  private cancelTick(): void {
    if (this.tickHandle != null) {
      clearTimeout(this.tickHandle);
      this.tickHandle = null;
    }
  }

  /** Returns true if the cursor moved. */
  private advanceCursor(direction: 1 | -1): boolean {
    if (this.state.status !== "ready") return false;
    const cursorTs = this.state.cursor.ts;

    let nextTs: Timestamp | null = null;
    for (const cache of this.caches.values()) {
      const flat = cache.flat;
      if (flat.length === 0) continue;
      if (direction === 1) {
        const idx = lowerBoundIndex(flat, cursorTs + 1);
        if (idx < flat.length) {
          const t = flat[idx].ts;
          if (nextTs == null || t < nextTs) nextTs = t;
        }
      } else {
        const idx = lowerBoundIndex(flat, cursorTs);
        const prev = flat[idx - 1];
        if (prev && (nextTs == null || prev.ts > nextTs)) nextTs = prev.ts;
      }
    }

    if (nextTs == null) {
      if (direction === 1) void this.maybePrefetchForward();
      return false;
    }

    const cursor: ReplayCursor = { ts: nextTs, seq: this.nextSeq++ };
    this.state = { ...this.state, cursor, window: this.computeWindow() };
    this.notify();
    this.emitBarsAt(nextTs);
    if (direction === 1) void this.maybePrefetchForward();
    return true;
  }

  private emitBarsAt(ts: Timestamp): void {
    if (this.state.status !== "ready") return;
    const seq = this.state.cursor.seq;
    for (const spec of this.activeSeries) {
      const cache = this.caches.get(seriesKey(spec));
      if (!cache) continue;
      const idx = lowerBoundIndex(cache.flat, ts);
      const bar = cache.flat[idx];
      if (bar && bar.ts === ts) {
        const event: ReplayBarEvent = { ts, seq, symbol: spec.symbol, interval: spec.interval, bar };
        for (const cb of this.barSubs) {
          try {
            cb(event);
          } catch {
            /* */
          }
        }
      }
    }
  }

  private async maybePrefetchForward(): Promise<void> {
    if (this.state.status !== "ready") return;
    const cursorTs = this.state.cursor.ts;
    const cursorDate = tsToDate(cursorTs);
    const tailPct = this.options.prefetchForwardOnTailPct;
    const manifest = this.state.manifest;

    for (const spec of this.activeSeries) {
      const cache = this.caches.get(seriesKey(spec));
      if (!cache) continue;
      const day = cache.days.get(cursorDate);
      if (!day || day.bars.length === 0) continue;
      const dayStart = day.bars[0].ts;
      const dayEnd = day.bars[day.bars.length - 1].ts;
      const span = dayEnd - dayStart;
      if (span <= 0) continue;
      const into = (cursorTs - dayStart) / span;
      if (into < 1 - tailPct) continue;
      const after = await manifest.source.listDatesAfter(spec.symbol, spec.interval, cursorDate, 1);
      const nextDate = after[0];
      if (!nextDate || cache.days.has(nextDate)) continue;
      void this.fetchAndCacheDay(manifest, spec, nextDate);
    }
  }

  private async ensureDayCached(ts: Timestamp): Promise<void> {
    if (this.state.status !== "ready") return;
    const date = tsToDate(ts);
    const manifest = this.state.manifest;
    await Promise.all(
      this.activeSeries.map(async (spec) => {
        const cache = this.caches.get(seriesKey(spec));
        if (cache?.days.has(date)) return;
        await this.fetchAndCacheDay(manifest, spec, date);
      }),
    );
    if (this.state.status === "ready") {
      this.dataVersion++;
      this.state = { ...this.state, dataVersion: this.dataVersion };
    }
  }

  private transition(next: ReplayState): void {
    this.state = next;
    this.notify();
  }

  private notify(): void {
    for (const cb of this.subs) {
      try {
        cb(this.state);
      } catch {
        /* */
      }
    }
  }
}

/** Convenience factory. */
export function createReplayController(options?: ReplayEngineOptions): ReplayController {
  return new ReplayControllerImpl(options);
}
