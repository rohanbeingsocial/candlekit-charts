import { useEffect, useState, type CSSProperties } from "react";
import type { ReplayController, ReplayState } from "../replay/types";

export interface ReplayControlsProps {
  controller: ReplayController;
  /** Speed multipliers offered. Default `[1, 2, 4, 8, 16]`. */
  speeds?: number[];
  className?: string;
  style?: CSSProperties;
}

/**
 * Transport controls for a {@link ReplayController}: play/pause, step ±, speed,
 * and a seek slider over the cached window. Subscribes to controller state.
 */
export function ReplayControls({ controller, speeds = [1, 2, 4, 8, 16], className, style }: ReplayControlsProps) {
  const [state, setState] = useState<ReplayState>(() => controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);

  const ready = state.status === "ready";
  const playing = ready && state.playing;
  const speed = ready ? state.speed : 1;
  const cursor = ready ? state.cursor.ts : 0;
  const window = ready ? state.window : { from: 0, to: 0 };

  return (
    <div className={className ?? "ck-replay"} style={style}>
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
        className="ck-replay-btn"
        disabled={!ready}
        title={playing ? "Pause" : "Play"}
        onClick={() => (playing ? controller.pause() : controller.play())}
      >
        {playing ? "⏸" : "▶"}
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

      <input
        type="range"
        className="ck-replay-seek"
        min={window.from}
        max={window.to}
        value={cursor}
        step={1}
        disabled={!ready || window.to <= window.from}
        onChange={(e) => controller.seek(Number(e.target.value))}
      />

      <span className="ck-replay-status">
        {state.status === "loading" ? "loading…" : state.status === "error" ? state.error : ""}
      </span>
    </div>
  );
}
