/**
 * Timezone helpers.
 *
 * lightweight-charts has no `timeZone` option — it always renders the UTC
 * components of a UNIX timestamp. To make a chart display wall-clock time for a
 * fixed-offset exchange (e.g. a market that is always UTC+5:30, no DST), shift
 * each bar's `ts` by the offset once at the data-adapter boundary so the UTC
 * components equal the local components. This is the only place the conversion
 * happens; everything downstream (drawings, replay cursor, sync) stays in the
 * shifted domain and remains positionally correct.
 *
 * For true 24h / UTC charts you do not need any of this — feed real epoch ms.
 */

import type { Timestamp } from "./types";

const MS_PER_MINUTE = 60_000;

/**
 * Add a fixed timezone offset (in minutes) to an epoch-ms timestamp so that the
 * value's UTC components equal the target local wall-clock. Use for fixed-offset
 * exchanges. `+330` = UTC+5:30.
 */
export function applyFixedOffset(tsUtcMs: Timestamp, offsetMinutes: number): Timestamp {
  return tsUtcMs + offsetMinutes * MS_PER_MINUTE;
}

/** Inverse of {@link applyFixedOffset}. */
export function stripFixedOffset(tsLocalMs: Timestamp, offsetMinutes: number): Timestamp {
  return tsLocalMs - offsetMinutes * MS_PER_MINUTE;
}

/** Calendar date `YYYY-MM-DD` from the UTC components of an epoch-ms value. */
export function dateOf(ts: Timestamp): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `HH:MM` from the UTC components of an epoch-ms value. */
export function timeOf(ts: Timestamp): string {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
