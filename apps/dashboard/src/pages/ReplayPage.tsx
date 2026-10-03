// Replay of one visit (address: /sessions/:id). Loads the visit and everything rrweb recorded,
// then plays it back with our own timeline, controls and Moments panel.
import type { SessionSummary } from "@replay/shared";
import type { eventWithTime } from "@rrweb/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { getEvents, getSession } from "../api";
import { browserName, formatDuration, shortUrl } from "../format";
import { IconFlame } from "../icons";
import { Controls } from "../replay/Controls";
import { Inspector } from "../replay/Inspector";
import { buildMoments } from "../replay/moments";
import { Theatre } from "../replay/Theatre";
import { Timeline } from "../replay/Timeline";
import { useReplayer } from "../replay/useReplayer";
import { Card, Notice } from "../ui";

type Loaded = { session: SessionSummary; events: eventWithTime[] };
type State = "loading" | "missing" | "offline" | Loaded;

export function ReplayPage() {
  const { id = "" } = useParams(); // the ":id" part of the address
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    setState("loading");
    // Ask for the visit and its events at the same time (both are needed before we can play).
    Promise.all([getSession(id), getEvents(id)])
      .then(([session, events]) => setState({ session, events }))
      .catch((error: Error) => setState(error.message.includes("404") ? "missing" : "offline"));
  }, [id]);

  if (state === "loading") {
    return (
      <Card>
        <Notice title="Loading the visit…" />
      </Card>
    );
  }
  if (state === "missing") {
    return (
      <Card>
        <Notice title="This visit doesn't exist">
          It may have been deleted.{" "}
          <Link to="/sessions" className="text-violet hover:underline">
            Back to all visits
          </Link>
        </Notice>
      </Card>
    );
  }
  if (state === "offline") {
    return (
      <Card>
        <Notice title="Can't reach the API">Start the API, then refresh this page.</Notice>
      </Card>
    );
  }

  // rrweb needs the page info (type 4) and a full snapshot of the page (type 2) to rebuild it.
  const replayable =
    state.events.some((e) => e.type === 4) && state.events.some((e) => e.type === 2);
  return (
    <section className="grid gap-[18px]">
      <ReplayHeader session={state.session} />
      {replayable ? (
        <ReplayView session={state.session} events={state.events} />
      ) : (
        <Card>
          <Notice title="Not enough was recorded to replay this visit">
            The visitor left within a few seconds, before the recorder sent anything.{" "}
            <Link to="/replay" className="text-violet hover:underline">
              Open the newest visit you can watch
            </Link>
          </Notice>
        </Card>
      )}
    </section>
  );
}

function ReplayHeader({ session }: { session: SessionSummary }) {
  const facts = [
    ["Length", formatDuration(session.durationMs)],
    ["Events", String(session.eventCount)],
    ["Clicks", String(session.clickCount)],
    ["Browser", browserName(session.userAgent)],
  ];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <nav className="flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
          <Link to="/sessions" className="font-medium hover:text-ink">
            ‹ Sessions
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate">{shortUrl(session.url)}</span>
        </nav>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[clamp(24px,2.6vw,32px)] leading-tight font-semibold text-ink">
            {shortUrl(session.url)}
          </h1>
          {session.hasRage ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent">
              <IconFlame width={13} height={13} />
              Rage clicks ×{session.rageClickCount}
            </span>
          ) : (
            <span className="rounded-lg bg-violet-soft px-2.5 py-1 text-[13px] font-semibold text-violet">
              No problems found
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {facts.map(([label, value]) => (
          <div key={label} className="grid gap-px rounded-[14px] bg-panel px-3.5 py-2">
            <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">
              {label}
            </span>
            <b className="font-mono text-sm font-medium text-ink">{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplayView({ session, events }: Loaded) {
  const player = useReplayer(events);
  const theatreRef = useRef<HTMLDivElement>(null);
  // useMemo: work out the Moments once per visit, not on every frame of playback.
  const moments = useMemo(() => buildMoments(events, session), [events, session]);

  // Space bar = play/pause (unless you're typing in a box or pressing a button).
  const { toggle } = player;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (e.key === " " && !["INPUT", "BUTTON", "TEXTAREA"].includes(tag)) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  function fullscreen() {
    const el = theatreRef.current;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el?.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div
        ref={theatreRef}
        className="grid min-w-0 gap-3 rounded-card bg-panel p-[18px] fullscreen:content-center fullscreen:rounded-none fullscreen:bg-bg"
      >
        <Theatre mountRef={player.mountRef} url={session.url} screen={player.screen} />
        <Timeline
          events={events}
          summary={session}
          time={player.time}
          total={player.total}
          onSeek={player.seek}
        />
        <Controls player={player} onFullscreen={fullscreen} />
      </div>
      <Inspector
        moments={moments}
        time={player.time}
        onSeek={player.seek}
        session={session}
        screen={player.screen}
      />
    </div>
  );
}
