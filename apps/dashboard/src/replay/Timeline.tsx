// The timeline under the replay: an activity graph (taller = more happening), a dot for each
// click (orange for rage clicks), red zones where rage bursts happened, and a playhead you can
// click or drag to jump around.
import type { SessionSummary } from "@replay/shared";
import type { eventWithTime } from "@rrweb/types";
import { useMemo, useRef } from "react";
import { formatDuration } from "../format";

const BUCKETS = 60;
const BURST_GAP_MS = 2000;

type Props = {
  events: eventWithTime[];
  summary: SessionSummary;
  time: number;
  total: number;
  onSeek: (ms: number) => void;
};

export function Timeline({ events, summary, time, total, onSeek }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // useMemo: only recalculate when the events change, not 60 times a second while playing.
  const bars = useMemo(() => {
    const counts = new Array<number>(BUCKETS).fill(0);
    const start = events[0]?.timestamp ?? 0;
    for (const e of events) {
      if (e.type !== 3) continue; // only "something happened" events, not page snapshots
      const i = Math.min(BUCKETS - 1, Math.floor(((e.timestamp - start) / (total || 1)) * BUCKETS));
      counts[i] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c) => Math.sqrt(c / max)); // sqrt so small activity still shows
  }, [events, total]);

  // Each click's time in ms (the API sends it as a fraction of the visit, 0 to 1).
  const clickTimes = useMemo(
    () => summary.clicks.map((c) => ({ at: c.at * summary.durationMs, rage: c.rage })),
    [summary],
  );
  // Group rage clicks that are close together into "bursts" (one red zone each).
  const bursts = useMemo(() => {
    const result: { from: number; to: number; count: number }[] = [];
    for (const c of clickTimes.filter((c) => c.rage)) {
      const last = result[result.length - 1];
      if (last && c.at - last.to <= BURST_GAP_MS) {
        last.to = c.at;
        last.count += 1;
      } else result.push({ from: c.at, to: c.at, count: 1 });
    }
    return result;
  }, [clickTimes]);

  const pct = (ms: number) => `${Math.max(0, Math.min(100, (ms / (total || 1)) * 100))}%`;
  const inRage = (bucket: number) => {
    const mid = ((bucket + 0.5) / BUCKETS) * total;
    return bursts.some((b) => mid >= b.from - 300 && mid <= b.to + 300);
  };

  function seekFromPointer(clientX: number) {
    const box = barRef.current?.getBoundingClientRect();
    if (box) onSeek(((clientX - box.left) / box.width) * total);
  }

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.round(total / 1000)}
      aria-valuenow={Math.round(time / 1000)}
      aria-valuetext={`${formatDuration(time)} of ${formatDuration(total)}`}
      className="relative h-[58px] cursor-pointer touch-none rounded-[10px] select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromPointer(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && seekFromPointer(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onSeek(time + 1000);
        if (e.key === "ArrowLeft") onSeek(time - 1000);
      }}
    >
      {bursts.map((b, i) => (
        <div
          key={i}
          // overflow-hidden: on long visits a zone can be very thin, so its label is clipped
          // instead of colliding with the next zone. The full text is in the tooltip.
          title={`Rage click: ${b.count} clicks the page didn't react to`}
          className="absolute top-0 bottom-2.5 overflow-hidden rounded-lg bg-accent-soft ring-1 ring-accent/35 ring-inset"
          style={{ left: pct(b.from - 300), width: `calc(${pct(b.to - b.from + 600)} + 4px)` }}
        >
          <span className="absolute top-px left-2 text-[10px] font-bold tracking-wider whitespace-nowrap text-accent uppercase">
            Rage · {b.count} clicks
          </span>
        </div>
      ))}

      <div className="absolute inset-x-0 top-3.5 bottom-3 flex items-end gap-[2px]">
        {bars.map((h, i) => {
          const past = ((i + 0.5) / BUCKETS) * total <= time;
          const rage = inRage(i);
          return (
            <span
              key={i}
              className={`min-h-[2px] flex-1 rounded-t-[2px] ${
                rage ? (past ? "bg-accent" : "bg-accent/30") : past ? "bg-violet" : "bg-violet/25"
              }`}
              style={{ height: `${Math.max(6, h * 100)}%` }}
            />
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[9px]">
        {clickTimes.map((c, i) => (
          <i
            key={i}
            className={`absolute bottom-px -ml-[3.5px] h-[7px] w-[7px] rounded-full ${c.rage ? "bg-accent" : "bg-violet"}`}
            style={{ left: pct(c.at) }}
          />
        ))}
      </div>

      <div
        className="absolute top-1 bottom-0 -ml-px w-0.5 rounded bg-ink before:absolute before:-top-[5px] before:-left-[5px] before:h-3 before:w-3 before:rounded-full before:bg-ink before:ring-[3px] before:ring-panel"
        style={{ left: pct(time) }}
      />
    </div>
  );
}
