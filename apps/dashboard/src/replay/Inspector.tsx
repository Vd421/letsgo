// The panel next to the replay: Moments (what happened, lighting up as the replay reaches it),
// Visitor (details about the visit) and AI (the Phase 5 summary, not built yet).
import type { SessionSummary } from "@replay/shared";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { browserName, formatClock, formatDuration, shortUrl } from "../format";
import { IconCursor, IconFlame } from "../icons";
import type { Moment, MomentKind } from "./moments";

type Tab = "moments" | "visitor" | "ai";

const icons: Record<MomentKind, ReactNode> = {
  page: (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M4 5h16v14H4zM4 9h16" />
    </svg>
  ),
  click: <IconCursor width={17} height={17} />,
  type: (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </svg>
  ),
  rage: <IconFlame width={17} height={17} />,
  end: (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
    </svg>
  ),
};

type Props = {
  moments: Moment[];
  time: number;
  onSeek: (ms: number) => void;
  session: SessionSummary;
  screen: { width: number; height: number };
};

export function Inspector({ moments, time, onSeek, session, screen }: Props) {
  const [tab, setTab] = useState<Tab>("moments");
  const listRef = useRef<HTMLOListElement>(null);

  // The active moment = the last one the replay has reached.
  let active = 0;
  moments.forEach((m, i) => {
    if (m.at <= time) active = i;
  });

  // Keep the active moment visible in a long list (scroll the list only, not the page).
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[active] as HTMLElement | undefined;
    if (!list || !item) return;
    if (
      item.offsetTop < list.scrollTop ||
      item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight
    ) {
      list.scrollTop = item.offsetTop - list.clientHeight / 3;
    }
  }, [active]);

  return (
    <div className="grid min-w-0 content-start gap-1.5 rounded-card bg-panel p-2">
      <div
        className="flex gap-1 rounded-full bg-panel-2 p-1"
        role="tablist"
        aria-label="Visit details"
      >
        {(["moments", "visitor", "ai"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-[7px] text-sm font-medium transition ${
              tab === t ? "bg-panel text-ink ring-1 ring-line" : "text-muted hover:text-ink"
            }`}
          >
            {t === "ai" ? "AI" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "moments" && (
        <ol ref={listRef} className="relative grid max-h-[560px] gap-0.5 overflow-auto p-1">
          {moments.map((m, i) => {
            const isActive = i === active;
            const future = m.at > time;
            const hot = m.kind === "rage";
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSeek(m.at)}
                  title="Jump to this moment"
                  className={`grid w-full grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-2.5 rounded-2xl p-2.5 text-left transition ${
                    isActive ? (hot ? "bg-accent-soft" : "bg-panel-2") : "hover:bg-panel-2"
                  } ${future ? "opacity-45" : ""}`}
                >
                  <span
                    className={`grid h-[34px] w-[34px] place-items-center rounded-[11px] transition ${
                      hot
                        ? isActive
                          ? "bg-accent text-white"
                          : "bg-accent-soft text-accent"
                        : isActive
                          ? "bg-violet-soft text-violet"
                          : "bg-panel-2 text-muted"
                    }`}
                  >
                    {icons[m.kind]}
                  </span>
                  <span className="min-w-0">
                    <b
                      className={`block text-sm leading-snug font-medium ${hot && isActive ? "text-accent" : "text-ink"}`}
                    >
                      {m.title}
                    </b>
                    {m.detail && (
                      <small className="mt-0.5 block text-[13px] leading-snug text-muted">
                        {m.detail}
                      </small>
                    )}
                  </span>
                  <span className="pt-0.5 font-mono text-xs text-muted">
                    {formatClock(m.at, session.durationMs)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {tab === "visitor" && (
        <dl className="m-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
          {[
            ["Page", shortUrl(session.url)],
            ["Browser", browserName(session.userAgent)],
            ["Screen", `${screen.width} × ${screen.height}`],
            [
              "Started",
              new Date(session.startedAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            ],
            ["Length", formatDuration(session.durationMs)],
            ["Events", String(session.eventCount)],
            ["Clicks", `${session.clickCount} (${session.rageClickCount} rage)`],
            ["Typing", "Hidden for privacy"],
          ].map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="m-0 font-mono text-[13px] [overflow-wrap:anywhere] text-ink">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {tab === "ai" && (
        <div className="m-1 rounded-[18px] bg-panel-2 p-[18px]">
          <span className="mb-2 inline-block text-xs font-semibold tracking-wider text-violet uppercase">
            AI summary · Phase 5
          </span>
          <p className="m-0 text-ink">
            In Phase 5, Claude will watch this visit and write a short summary here, pointing out
            anything that looks like a bug.
          </p>
        </div>
      )}
    </div>
  );
}
