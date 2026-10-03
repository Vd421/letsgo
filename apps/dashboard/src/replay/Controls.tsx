// The buttons under the timeline: play/pause, restart, clock, speed, skip idle, full screen.
import { formatClock } from "../format";
import type { ReplayControls } from "./useReplayer";

const SPEEDS = [0.5, 1, 2, 4];
const iconButton =
  "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-ink transition hover:bg-line active:scale-95";

type Props = { player: ReplayControls; onFullscreen: () => void };

export function Controls({ player, onFullscreen }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={player.toggle}
        aria-label={player.playing ? "Pause" : "Play"}
        title={player.playing ? "Pause (space)" : "Play (space)"}
        className="grid h-[46px] w-[46px] place-items-center rounded-2xl bg-ink text-bg transition-[border-radius,transform] hover:rounded-full active:scale-95"
      >
        {player.playing ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={player.restart}
        aria-label="Play from the start"
        title="Play from the start"
        className={iconButton}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12a8 8 0 1 0 2.4-5.7" />
          <path d="M4 4v4h4" />
        </svg>
      </button>

      <span className="font-mono text-[13px] whitespace-nowrap text-muted tabular-nums">
        <b className="font-medium text-ink">{formatClock(player.time, player.total)}</b> /{" "}
        {formatClock(player.total, player.total)}
      </span>

      <div
        className="ml-auto flex gap-0.5 rounded-full bg-panel-2 p-[3px]"
        role="group"
        aria-label="Playback speed"
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={player.speed === s}
            onClick={() => player.setSpeed(s)}
            className={`rounded-full px-2.5 py-[5px] text-[13px] font-semibold tabular-nums transition ${
              player.speed === s
                ? "bg-panel text-ink ring-1 ring-line"
                : "text-muted hover:text-ink"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <label
        className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium whitespace-nowrap text-muted"
        title="Fast-forward through moments where nothing happens"
      >
        <input
          type="checkbox"
          checked={player.skipIdle}
          onChange={(e) => player.setSkipIdle(e.target.checked)}
          className="peer sr-only"
        />
        {/* A switch drawn with Tailwind: grey when off, violet when on (peer = the checkbox above). */}
        <span className="relative h-5 w-[34px] rounded-full bg-line transition peer-checked:bg-violet peer-focus-visible:ring-2 peer-focus-visible:ring-violet after:absolute after:top-[3px] after:left-[3px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3.5" />
        Skip idle
      </label>

      <button
        type="button"
        onClick={onFullscreen}
        aria-label="Full screen"
        title="Full screen"
        className={iconButton}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
    </div>
  );
}
