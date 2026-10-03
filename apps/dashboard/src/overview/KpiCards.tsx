// The four number cards at the top of the Overview: the "how are things?" answer.
import type { ReactNode } from "react";
import type { Stats } from "../stats";
import { IconFlame } from "../icons";

const trendUp = (
  <svg
    viewBox="0 0 24 24"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
  </svg>
);

function Kpi(props: { label: string; value: string; badge: ReactNode; foot: string }) {
  return (
    <div className="grid gap-3.5 rounded-card bg-panel p-[22px]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink">{props.label}</span>
        {props.badge}
      </div>
      <div className="font-display text-[34px] leading-none font-semibold text-ink tabular-nums">
        {props.value}
      </div>
      <div className="text-[13px] text-muted">{props.foot}</div>
    </div>
  );
}

const badge =
  "inline-flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-[3px] text-xs font-semibold whitespace-nowrap tabular-nums";

export function KpiCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Visits"
        value={String(stats.visits)}
        badge={
          <span className={`${badge} text-violet`}>
            {trendUp}+{stats.visitsToday} today
          </span>
        }
        foot={
          stats.emptyVisits
            ? `${stats.emptyVisits} empty visits not counted`
            : "Every recorded visit"
        }
      />
      <Kpi
        label="Rage-click visits"
        value={String(stats.rageVisits)}
        badge={
          <span className={`${badge} text-accent`}>
            <IconFlame width={13} height={13} />
            {stats.ragePercent}%
          </span>
        }
        foot={`${stats.rageClicks} clicks the page didn't react to`}
      />
      <Kpi
        label="No problems"
        value={String(stats.calmVisits)}
        badge={
          <span className={`${badge} text-violet`}>
            {trendUp}
            {stats.calmPercent}%
          </span>
        }
        foot="Visits without rage clicks"
      />
      <Kpi
        label="Events recorded"
        value={stats.events.toLocaleString("en-GB")}
        badge={<span className={`${badge} text-text`}>{stats.avgEvents} / visit</span>}
        foot="Clicks, typing and page changes"
      />
    </div>
  );
}
