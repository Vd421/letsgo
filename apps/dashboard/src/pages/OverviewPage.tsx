// Overview: the dashboard's front page. Summary first (number cards), then patterns
// (heatmap + chart), then details (outcomes + recent visits). Refreshes every 10 seconds.
import { useMemo } from "react";
import { EventsChart } from "../overview/EventsChart";
import { Heatmap } from "../overview/Heatmap";
import { KpiCards } from "../overview/KpiCards";
import { Outcomes } from "../overview/Outcomes";
import { RecentVisits } from "../overview/RecentVisits";
import { computeStats } from "../stats";
import { Card, Notice } from "../ui";
import { useSessions } from "../useSessions";

export function OverviewPage() {
  const { sessions, reload } = useSessions();
  // Do the maths only when the visits change, not on every render.
  const stats = useMemo(() => (sessions ? computeStats(sessions) : null), [sessions]);

  if (sessions === undefined) {
    return (
      <div className="grid gap-5" aria-label="Loading">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-card bg-panel" />
          ))}
        </div>
        <div className="h-[340px] animate-pulse rounded-card bg-panel" />
      </div>
    );
  }
  if (sessions === null || !stats) {
    return (
      <Card>
        <Notice title="Can't reach the API">
          Start it, then{" "}
          <button type="button" onClick={reload} className="text-violet hover:underline">
            try again
          </button>
          .
        </Notice>
      </Card>
    );
  }
  if (stats.visits === 0) {
    return (
      <Card>
        <Notice title="No visits yet">
          Open Tiny Shop (npm run shop) and click around. Your overview fills in within seconds.
        </Notice>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <KpiCards stats={stats} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Heatmap grid={stats.heatmap} />
        <EventsChart visits={stats.recent} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Outcomes stats={stats} />
        <RecentVisits visits={stats.recent.slice(-5).reverse()} />
      </div>
    </div>
  );
}
