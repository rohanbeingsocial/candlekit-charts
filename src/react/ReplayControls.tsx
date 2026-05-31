import { useEffect, useState, type CSSProperties } from "react";
import type { ReplayController, ReplayState } from "../replay/types";

export interface ReplayControlsProps {
  controller: ReplayController;
  /** Speed multipliers offered. Default `[0.5, 1, 2, 4, 8, 16, 32]`. */
  speeds?: number[];
  /** Format the cursor timestamp + range labels. Default `toLocaleTimeString`. */
  formatTime?: (ts: number) => string;
  /** Optional quick-jump buttons (e.g. session open/close). Seeks, clamped to window. */
  jumps?: { label: string; ts: number }[];
  /** Show the cursor clock + progress bar. Default `true`. */
  showProgress?: boolean;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_SPEEDS = [0.5, 1, 2, 4, 8, 16, 32];
const defaultFormat = (ts: number) => new Date(ts).toLocaleTimeString();

/**
 * Transport panel for a {@link ReplayController}: status, cursor clock + progress,
 * play/pause, step ±, speed, a seek slider, and optional quick-jumps. Subscribes
 * to controller state. Styled via `.ck-replay*` (see styles.css).
 */
export function ReplayControls({
  controller,
  speeds = DEFAULT_SPEEDS,
  formatTime = defaultFormat,
  jumps,
  showProgress = true,
  className,
  style,
}: ReplayControlsProps) {
  const [state, setState] = useState<ReplayState>(() => controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);

  const status = state.status;
  const ready = status === "ready";
  const playing = ready && state.playing;
  const speed = ready ? state.speed : 1;
  const cursor = ready ? state.cursor.ts : 0;
  const window = ready ? state.window : { from: 0, to: 0 };
  const span = window.to - window.from;
  const progress = ready && span > 0 ? Math.min(1, Math.max(0, (cursor - window.from) / span)) : 0;

  const badge =
    status === "ready" ? "REPLAY" : status === "loading" ? "LOADING" : status === "error" ? "ERROR" : "IDLE";

  const seekClamped = (ts: number) => controller.seek(Math.max(window.from, Math.min(window.to, ts)));

  return (
    <div className={className ?? "ck-replay"} style={style}>
      <div className="ck-replay-head">
        <span className="ck-replay-title">Replay</span>
        <span className={`ck-replay-badge ck-replay-badge--${status}`}>{badge}</span>
      </div>

      {showProgress && ready && (
        <div className="ck-replay-clock">
          <div className="ck-replay-time">{formatTime(cursor)}</div>
          <div className="ck-replay-bar">
            <div className="ck-replay-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="ck-replay-range">
            <span>{formatTime(window.from)}</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>{formatTime(window.to)}</span>
          </div>
        </div>
      )}

      <div className="ck-replay-transport">
        <button
          type="button"
          className="ck-replay-btn"
          disabled={!ready}
          title="Step back"
          onClick={() => controller.step(-1)}
        >
          ⏮
        </button>
        <button
          type="button"
          className={`ck-replay-btn ck-replay-btn--${playing ? "pause" : "play"}`}
          disabled={!ready}
          title={playing ? "Pause" : "Play"}
          onClick={() => (playing ? controller.pause() : controller.play())}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          className="ck-replay-btn"
          disabled={!ready}
          title="Step forward"
          onClick={() => controller.step(1)}
        >
          ⏭
        </button>
        <select
          className="ck-replay-speed"
          value={speed}
          disabled={!ready}
          title="Playback speed"
          onChange={(e) => controller.setSpeed(Number(e.target.value))}
        >
          {speeds.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>

      <input
        type="range"
        className="ck-replay-seek"
        min={window.from}
        max={window.to}
        value={cursor}
        step={1}
        disabled={!ready || span <= 0}
        onChange={(e) => controller.seek(Number(e.target.value))}
      />

      {jumps && jumps.length > 0 && (
        <div className="ck-replay-jumps">
          {jumps.map((j) => (
            <button
              key={j.label}
              type="button"
              className="ck-replay-jump"
              disabled={!ready}
              onClick={() => seekClamped(j.ts)}
            >
              {j.label}
            </button>
          ))}
        </div>
      )}

      {status === "error" && <div className="ck-replay-error">{state.error}</div>}
    </div>
  );
}
