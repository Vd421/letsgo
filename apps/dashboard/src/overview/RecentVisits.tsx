// "Recent visits": the five newest visits. Click one to watch it.
// Uses the Tiny Shop fonts (font-shop), as in the approved design.
import type { SessionSummary } from "@replay/shared";
import { Link, useNavigate } from "react-router";
import { browserName, formatDuration, formatTime } from "../format";
import { IconFlame } from "../icons";

const th =
  "bg-panel-2 px-3.5 py-[11px] text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase";

export function RecentVisits({ visits }: { visits: SessionSummary[] }) {
  const navigate = useNavigate();
  return (
    <div className="min-w-0 rounded-card bg-panel p-[22px] font-shop">
      <div className="mb-[18px] flex items-center justify-between">
        <h3 className="m-0 font-shop-display text-lg font-semibold tracking-tight text-ink">
          Recent visits
        </h3>
        <Link to="/sessions" className="text-sm text-muted hover:text-ink">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${th} rounded-l-[10px]`}>Visit</th>
              <th className={`${th} text-right`}>Length</th>
              <th className={`${th} text-right`}>Events</th>
              <th className={`${th} text-right`}>Clicks</th>
              <th className={`${th} rounded-r-[10px]`}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr
                key={v.id}
                tabIndex={0}
                onClick={() => navigate(`/sessions/${v.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/sessions/${v.id}`)}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-panel-2 focus-visible:bg-panel-2"
              >
                <td className="px-3.5 py-3.5 whitespace-nowrap">
                  <span className="font-semibold text-ink">{formatTime(v.startedAt)}</span>
                  <span className="ml-2 text-[13px] text-muted">{browserName(v.userAgent)}</span>
                </td>
                <td className="px-3.5 py-3.5 text-right text-ink tabular-nums">
                  {formatDuration(v.durationMs)}
                </td>
                <td className="px-3.5 py-3.5 text-right text-ink tabular-nums">{v.eventCount}</td>
                <td className="px-3.5 py-3.5 text-right text-ink tabular-nums">{v.clickCount}</td>
                <td className="px-3.5 py-3.5 whitespace-nowrap">
                  {v.hasRage ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-accent">
                      <IconFlame width={14} height={14} />
                      Rage ×{v.rageClickCount}
                    </span>
                  ) : (
                    <span className="font-medium text-violet">No problems</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
