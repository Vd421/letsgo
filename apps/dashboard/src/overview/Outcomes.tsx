// "Outcomes": six small tiles summing up how visits went.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatDuration } from "../format";
import { IconFlame } from "../icons";
import type { Stats } from "../stats";

function Tile(props: {
  icon: ReactNode;
  tone?: "bad" | "good";
  label: string;
  value: string;
  unit: string;
}) {
  const tone =
    props.tone === "bad" ? "text-accent" : props.tone === "good" ? "text-violet" : "text-muted";
  return (
    <div className="grid grid-rows-[auto_1fr_auto] gap-2 rounded-tile bg-panel-2 p-3.5">
      <span className={`grid h-7 w-7 place-items-center rounded-lg bg-panel ${tone}`}>
        {props.icon}
      </span>
      <span className="text-[13px] leading-snug text-text">{props.label}</span>
      <b className="font-display text-[22px] leading-none font-semibold text-ink tabular-nums">
        {props.value}
        <small className="ml-1 font-sans text-[11px] font-medium text-muted">{props.unit}</small>
      </b>
    </div>
  );
}

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

// "1:46:53" is hours, "5:03" is minutes.
const durationUnit = (ms: number) => (ms >= 3_600_000 ? "hours" : "min");

export function Outcomes({ stats }: { stats: Stats }) {
  return (
    <div className="min-w-0 rounded-card bg-panel p-[22px]">
      <div className="mb-[18px] flex items-center justify-between">
        <h3 className="m-0 text-base font-medium text-ink">Outcomes</h3>
        <Link to="/sessions" className="text-sm text-muted hover:text-ink">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Tile
          icon={<IconFlame width={15} height={15} />}
          tone="bad"
          label="Rage-click visits"
          value={String(stats.rageVisits)}
          unit="visits"
        />
        <Tile
          icon={icon("M5 12l5 5 9-10")}
          tone="good"
          label="No problems"
          value={String(stats.calmVisits)}
          unit="visits"
        />
        <Tile
          icon={icon("M12 2s5 4.5 5 10a5 5 0 0 1-10 0")}
          tone="bad"
          label="Dead clicks in bursts"
          value={String(stats.rageClicks)}
          unit="clicks"
        />
        <Tile
          icon={icon("M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z")}
          label="Average visit"
          value={formatDuration(stats.avgDurationMs)}
          unit={durationUnit(stats.avgDurationMs)}
        />
        <Tile
          icon={icon("M4 20V10M10 20V4M16 20v-7M22 20H2")}
          label="Longest visit"
          value={formatDuration(stats.longestDurationMs)}
          unit={durationUnit(stats.longestDurationMs)}
        />
        <Tile
          icon={icon("M18 6L6 18M6 6l12 12")}
          label="Left too fast to record"
          value={String(stats.emptyVisits)}
          unit="visits"
        />
      </div>
    </div>
  );
}
