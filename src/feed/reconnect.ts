/**
 * Resilient wrapper for any {@link RealtimeFeed}. Adds automatic reconnect with
 * exponential backoff + jitter, transparent resubscribe of all tracked symbols,
 * and a unified status stream. Adapters stay dumb (connect/subscribe/emit); this
 * owns the recovery state machine.
 */

import type { FeedMessage, FeedStatus, RealtimeFeed, SubscribeOptions } from "./types";
import type { SymbolId, Timestamp } from "../core/types";

/** Extract the event timestamp from any feed message (ohlc carries it on bar). */
function messageTs(m: FeedMessage): Timestamp {
  return m.kind === "ohlc" ? m.bar.ts : m.ts;
}

export interface ReconnectOptions {
  /** First backoff delay in ms. Default 500. */
  baseDelayMs?: number;
  /** Backoff ceiling in ms. Default 30_000. */
  maxDelayMs?: number;
  /** Multiplier per attempt. Default 2. */
  factor?: number;
  /** Jitter fraction [0..1] applied to each delay. Default 0.3. */
  jitter?: number;
  /** Give up after N consecutive failures. Default Infinity. */
  maxAttempts?: number;
}

interface Sub {
  symbol: SymbolId;
  onMessage: (m: FeedMessage) => void;
  opts?: SubscribeOptions;
  /** Live unsubscribe handle into the underlying feed for the current socket. */
  off: (() => void) | null;
}

/**
 * Wrap a feed factory (a fresh feed per physical connection is cleanest, but a
 * reusable singleton also works). Returns a {@link RealtimeFeed} whose
 * `subscribe` set survives reconnects.
 */
export function withReconnect(factory: () => RealtimeFeed, options: ReconnectOptions = {}): RealtimeFeed {
  const baseDelay = options.baseDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 30_000;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? 0.3;
  const maxAttempts = options.maxAttempts ?? Infinity;

  let feed: RealtimeFeed | null = null;
  let detachStatus: (() => void) | null = null;
  let status: FeedStatus = { state: "idle", attempt: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wantConnected = false;
  let attempt = 0;

  const subs = new Set<Sub>();
  const statusSubs = new Set<(s: FeedStatus) => void>();

  const setStatus = (next: Partial<FeedStatus>): void => {
    status = { ...status, ...next };
    for (const cb of statusSubs) {
      try {
        cb(status);
      } catch {
        /* isolated */
      }
    }
  };

  const wireSubs = (f: RealtimeFeed): void => {
    for (const s of subs) {
      s.off = f.subscribe(
        s.symbol,
        (m) => {
          setStatus({ lastMessageAt: messageTs(m) });
          s.onMessage(m);
        },
        s.opts,
      );
    }
  };

  const backoff = (): number => {
    const raw = Math.min(maxDelay, baseDelay * Math.pow(factor, attempt));
    const j = raw * jitter * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(raw + j));
  };

  const scheduleReconnect = (err?: string): void => {
    if (!wantConnected) return;
    if (attempt >= maxAttempts) {
      setStatus({ state: "error", error: err ?? "max reconnect attempts reached" });
      return;
    }
    setStatus({ state: "reconnecting", attempt, error: err });
    const delay = backoff();
    timer = setTimeout(() => {
      timer = null;
      void open();
    }, delay);
  };

  const teardownFeed = (): void => {
    detachStatus?.();
    detachStatus = null;
    for (const s of subs) s.off = null;
    if (feed) {
      try {
        feed.disconnect();
      } catch {
        /* */
      }
    }
    feed = null;
  };

  const open = async (): Promise<void> => {
    if (!wantConnected) return;
    teardownFeed();
    setStatus({ state: attempt === 0 ? "connecting" : "reconnecting", attempt });
    const f = factory();
    feed = f;

    // Mirror the underlying feed's own status, but drive reconnect off failures.
    detachStatus = f.onStatus((s) => {
      if (s.state === "error" || s.state === "closed") {
        if (wantConnected) scheduleReconnect(s.error);
      }
    });

    try {
      await f.connect();
      attempt = 0;
      setStatus({ state: "connected", attempt: 0, error: undefined });
      wireSubs(f);
    } catch (e) {
      attempt += 1;
      scheduleReconnect(e instanceof Error ? e.message : String(e));
    }
  };

  return {
    async connect() {
      wantConnected = true;
      attempt = 0;
      await open();
    },
    disconnect() {
      wantConnected = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      teardownFeed();
      setStatus({ state: "closed", attempt: 0 });
    },
    getStatus() {
      return status;
    },
    onStatus(cb) {
      statusSubs.add(cb);
      return () => statusSubs.delete(cb);
    },
    subscribe(symbol, onMessage, opts) {
      const sub: Sub = { symbol, onMessage, opts, off: null };
      subs.add(sub);
      if (feed && status.state === "connected") {
        sub.off = feed.subscribe(
          symbol,
          (m) => {
            setStatus({ lastMessageAt: messageTs(m) });
            onMessage(m);
          },
          opts,
        );
      }
      return () => {
        sub.off?.();
        subs.delete(sub);
      };
    },
  };
}
