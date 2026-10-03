// "Visits by time": which days and times of day your site gets visits. Each square is one
// 4-hour block on one weekday; the stronger the orange, the more visits started then.
import { DAYS, TIME_BLOCKS } from "../stats";

// Levels of colour, from "nothing" to "busy". Low levels are hatched (striped), like the design.
const LEVELS = [
  { min: 0, label: "0", className: "bg-panel-2" },
  {
    min: 1,
    label: "1",
    className:
      "bg-panel-2 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_50%,transparent)_0_1.5px,transparent_1.5px_5px)]",
  },
  {
    min: 2,
    label: "2–3",
    className:
      "bg-accent/20 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--accent)_75%,transparent)_0_2px,transparent_2px_5px)]",
  },
  { min: 4, label: "4–6", className: "bg-accent/70" },
  { min: 7, label: "7+", className: "bg-accent" },
];

function levelFor(count: number) {
  return [...LEVELS].reverse().find((l) => count >= l.min) ?? LEVELS[0];
}

export function Heatmap({ grid }: { grid: number[][] }) {
  return (
    <div className="min-w-0 rounded-card bg-panel p-[22px]">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-base font-medium text-ink">Visits by time</h3>
        <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted" aria-label="Legend">
          {LEVELS.slice(1).map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <i className={`inline-block h-[11px] w-[11px] rounded-[3px] ${l.className}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] items-center gap-x-1.5 gap-y-2"
        role="table"
        aria-label="Visits per weekday and time of day"
      >
        {TIME_BLOCKS.map((block, row) => (
          <div key={block} className="contents" role="row">
            <span className="font-mono text-xs whitespace-nowrap text-muted" role="rowheader">
              {block}
            </span>
            {DAYS.map((day, col) => {
              const count = grid[row][col];
              return (
                <span
                  key={day}
                  role="cell"
                  title={`${day} ${block}: ${count} ${count === 1 ? "visit" : "visits"}`}
                  className={`h-9 rounded-lg ${levelFor(count).className}`}
                />
              );
            })}
          </div>
        ))}
        <span />
        {DAYS.map((day) => (
          <span key={day} className="text-center text-xs text-muted">
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}
