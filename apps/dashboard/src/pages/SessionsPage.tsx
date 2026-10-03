// Sessions: every recorded visit, newest first, with a "clicks over time" strip and rage badges.
// Uses the same fonts as Tiny Shop (font-shop / font-shop-display), as in the approved design.
import type { SessionSummary } from "@replay/shared";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { browserName, formatDay, formatDuration, formatTime, shortUrl } from "../format";
import { IconFlame, IconPlay } from "../icons";
import { Notice } from "../ui";
import { isReplayable, useSessions } from "../useSessions";

type Filter = "all" | "rage" | "calm";

export function SessionsPage() {
  const { sessions, reload: load } = useSessions(); // refreshes every 10 seconds
  const [filter, setFilter] = useState<Filter>("all");
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase(); // typed in the top bar's search

  // Hide empty visits: the visitor left before anything was sent, so there's nothing to watch.
  const all = (sessions ?? []).filter(isReplayable);
  const hiddenCount = (sessions ?? []).length - all.length;
  const counts = {
    all: all.length,
    rage: all.filter((s) => s.hasRage).length,
    calm: all.filter((s) => !s.hasRage).length,
  };
  const shown = all.filter((s) => {
    const matchesFilter = filter === "all" || (filter === "rage") === s.hasRage;
    const text = `${shortUrl(s.url)} ${browserName(s.userAgent)}`.toLowerCase();
    return matchesFilter && text.includes(query);
  });

  return (
    <section className="grid gap-[18px] font-shop">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-shop-display text-[32px] leading-tight font-extrabold tracking-tight text-ink">
            Sessions
          </h1>
          <p className="text-muted">
            Every recorded visit, newest first. Updates every 10 seconds.
            {hiddenCount > 0 && (
              <span title="The visitor left before anything was recorded, so there's nothing to replay.">
                {" "}
                {hiddenCount} empty {hiddenCount === 1 ? "visit" : "visits"} hidden.
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter visits">
          <Chip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={counts.all}
          />
          <Chip
            active={filter === "rage"}
            onClick={() => setFilter("rage")}
            label="Rage clicks"
            count={counts.rage}
          />
          <Chip
            active={filter === "calm"}
            onClick={() => setFilter("calm")}
            label="No problems"
            count={counts.calm}
          />
        </div>
      </div>

      <div className="min-w-0 rounded-card bg-panel p-3.5">
        {sessions === undefined && <SkeletonRows />}
        {sessions === null && (
          <Notice title="Can't reach the API">
            Start it with <code className="font-mono text-ink">python -m app.main</code> in
            apps/api-py, then{" "}
            <button type="button" onClick={load} className="text-violet hover:underline">
              try again
            </button>
            .
          </Notice>
        )}
        {sessions && sessions.length === 0 && (
          <Notice title="No visits yet">
            Open Tiny Shop (<code className="font-mono text-ink">npm run shop</code>) and click
            around. Visits appear here within a few seconds.
          </Notice>
        )}
        {sessions && sessions.length > 0 && shown.length === 0 && (
          <Notice title="No visits match">Try a different search or filter.</Notice>
        )}
        {shown.length > 0 && <SessionsTable sessions={shown} />}
      </div>
    </section>
  );
}

function Chip(props: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-95 ${
        props.active
          ? "bg-ink text-bg" // selected: a solid pill, impossible to miss
          : "bg-panel text-text ring-1 ring-line hover:bg-panel-2 hover:text-ink hover:ring-muted/50"
      }`}
    >
      {props.label}
      <span className={`tabular-nums ${props.active ? "opacity-60" : "text-muted"}`}>
        {props.count}
      </span>
    </button>
  );
}

const th =
  "bg-panel-2 px-3.5 py-[11px] text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase";

function SessionsTable({ sessions }: { sessions: SessionSummary[] }) {
  const navigate = useNavigate();
  const open = (id: string) => navigate(`/sessions/${id}`);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr>
            <th className={`${th} rounded-l-[10px]`}>Started</th>
            <th className={th}>Visit</th>
            <th className={th}>Clicks over time</th>
            <th className={`${th} text-right`}>Events</th>
            <th className={`${th} text-right`}>Clicks</th>
            <th className={th}>Outcome</th>
            <th className={`${th} rounded-r-[10px]`}>
              <span className="sr-only">Replay</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* .map() turns each session into one table row. "key" helps React track rows. */}
          {sessions.map((s) => (
            <tr
              key={s.id}
              tabIndex={0}
              onClick={() => open(s.id)}
              onKeyDown={(e) => e.key === "Enter" && open(s.id)}
              className="group cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-panel-2 focus-visible:bg-panel-2"
            >
              <td className="px-3.5 py-3.5 whitespace-nowrap">
                <span className="font-mono text-sm text-ink">{formatTime(s.startedAt)}</span>
                <span className="block text-xs text-muted">{formatDay(s.startedAt)}</span>
              </td>
              <td className="px-3.5 py-3.5">
                <span className="font-semibold text-ink">{shortUrl(s.url)}</span>
                <span className="block text-[13px] text-muted">
                  {browserName(s.userAgent)} · {formatDuration(s.durationMs)}
                </span>
              </td>
              <td className="px-3.5 py-3.5">
                <ClickStrip session={s} />
              </td>
              <td className="px-3.5 py-3.5 text-right text-ink tabular-nums">{s.eventCount}</td>
              <td className="px-3.5 py-3.5 text-right text-ink tabular-nums">{s.clickCount}</td>
              <td className="px-3.5 py-3.5 whitespace-nowrap">
                <Outcome session={s} />
              </td>
              <td className="px-3.5 py-3.5 text-right">
                <span className="inline-grid h-[34px] w-[34px] place-items-center rounded-full bg-panel-2 text-ink transition group-hover:scale-105 group-hover:bg-violet group-hover:text-on-color">
                  <IconPlay width={13} height={13} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A tiny timeline of the visit: one mark per click, red where the clicks were rage clicks. */
function ClickStrip({ session }: { session: SessionSummary }) {
  return (
    <div
      className="relative h-[22px] w-[150px] overflow-hidden rounded-md bg-panel-2"
      role="img"
      aria-label={`${session.clickCount} clicks, ${session.rageClickCount} of them rage clicks`}
    >
      {session.clicks.map((c, i) => (
        <i
          key={i}
          className={`absolute top-[5px] h-3 w-[3px] rounded-sm ${c.rage ? "bg-accent" : "bg-muted/80"}`}
          style={{ left: `calc(${(c.at * 100).toFixed(2)}% * 0.94 + 3%)` }}
        />
      ))}
    </div>
  );
}

function Outcome({ session }: { session: SessionSummary }) {
  if (session.hasRage) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-accent">
        <IconFlame width={14} height={14} />
        Rage clicks ×{session.rageClickCount}
      </span>
    );
  }
  if (session.clickCount === 0) return <span className="text-muted">No clicks</span>;
  return <span className="font-medium text-violet">No problems found</span>;
}

/** Grey placeholder rows while the visits load. */
function SkeletonRows() {
  return (
    <div className="grid gap-2 p-1" aria-label="Loading visits">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-panel-2" />
      ))}
    </div>
  );
}
