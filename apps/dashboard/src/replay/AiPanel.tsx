// The AI tab: Claude's summary of the visit and the bugs it spotted, in every state
// (not set up, never analysed, working, done, failed). Built to docs/design/ai-summary.html.
import type { BugFlag, SessionAnalysis } from "@replay/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { formatElapsed, secondsSince, SLOW_HINT_S, sortBugs } from "../analysis";
import { formatDuration } from "../format";
import type { AnalysisState } from "../useAnalysis";

// Reused class strings, so the buttons and cards look the same everywhere in the panel.
const card = "grid gap-3 rounded-[18px] bg-panel-2 p-[18px] motion-safe:animate-ai-in";
const iconTile = "grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-panel text-muted";
const title = "m-0 text-[15px] leading-snug font-medium text-ink";
const quiet = "m-0 text-[13px] leading-[1.45] text-muted";
const meta = "font-mono text-xs text-muted";
const btnPrimary =
  "inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-bg transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100";
const btnSecondary =
  "inline-flex h-[38px] items-center justify-center gap-2 rounded-full bg-panel px-[18px] text-sm font-semibold text-ink ring-1 ring-line transition hover:bg-line active:scale-[0.97] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100";
const btnLink =
  "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-50 motion-reduce:transition-none";

/** A small line icon: the same drawing style as the rest of the dashboard. */
function Svg({ size = 17, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
const KeyIcon = () => (
  <Svg>
    <circle cx="8" cy="15" r="4" />
    <path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" />
  </Svg>
);
const DocIcon = () => (
  <Svg>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 12h7M9 16h5" />
  </Svg>
);
const AlertIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </Svg>
);
const CheckIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M5 12l5 5 9-10" strokeWidth="3" />
  </Svg>
);
const RedoIcon = ({ size = 14 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" />
    <path d="M20 4v4h-4" />
  </Svg>
);

type Props = {
  ai: AnalysisState;
  /** Move the replay to this time (ms). */
  onSeek: (ms: number) => void;
};

export function AiPanel({ ai, onSeek }: Props) {
  const { analysis } = ai;
  // Key by status so each new state plays its entrance animation again.
  const key = analysis === undefined ? "loading" : (analysis?.status ?? "none");
  return (
    <div
      className="grid max-h-[560px] content-start gap-2.5 overflow-auto p-1"
      aria-live="polite"
      aria-busy={analysis === undefined}
    >
      <PanelBody key={key} ai={ai} onSeek={onSeek} />
    </div>
  );
}

function PanelBody({ ai, onSeek }: Props) {
  const { analysis, configured, model, statusChecked, error, starting, start } = ai;

  if (analysis === undefined) {
    return (
      <div className={card} aria-label="Loading the AI analysis">
        <Skeleton />
      </div>
    );
  }
  if (analysis === null && error && !starting && configured !== false) {
    // Loading failed (not a failed analysis): the API is probably off.
    return (
      <div className={card}>
        <span className={iconTile}>
          <AlertIcon />
        </span>
        <p className={title}>Couldn&rsquo;t load the AI analysis</p>
        <p className={quiet}>{error}</p>
      </div>
    );
  }
  if (analysis === null) {
    if (configured === false) return <NotConfigured />;
    return (
      <div className={card}>
        <span className={iconTile}>
          <DocIcon />
        </span>
        <p className={title}>Get a summary of this visit</p>
        <p className={quiet}>
          Claude reads an outline of the clicks and pages (never what was typed) and points out
          anything that looks like a bug. Takes about 10 seconds.
        </p>
        {statusChecked && configured === undefined && (
          <p className={quiet}>
            Couldn&rsquo;t check whether AI is set up. You can still try; if it isn&rsquo;t, you
            will be told.
          </p>
        )}
        {error && (
          <p className="m-0 text-[13px] text-accent" role="alert">
            {error}
          </p>
        )}
        <button type="button" className={btnPrimary} onClick={start} disabled={starting}>
          {starting ? "Starting…" : "Analyze visit"}
        </button>
        {model && <span className={meta}>Model {model}</span>}
      </div>
    );
  }
  if (analysis.status === "queued" || analysis.status === "running") {
    return <Working ai={ai} analysis={analysis} />;
  }
  if (analysis.status === "failed") {
    return (
      <div className={card}>
        <span className={iconTile}>
          <AlertIcon />
        </span>
        <p className={title}>Couldn&rsquo;t analyse this visit</p>
        <p className={quiet}>{analysis.error ?? "Something went wrong. Nothing was saved."}</p>
        {error && (
          <p className="m-0 text-[13px] text-accent" role="alert">
            {error}
          </p>
        )}
        <div>
          <button type="button" className={btnSecondary} onClick={start} disabled={starting}>
            <RedoIcon size={16} />
            Retry
          </button>
        </div>
        <span className={meta}>{[analysis.model, shortTime(analysis.updatedAt)].join(" · ")}</span>
      </div>
    );
  }
  // key: a new result (e.g. after Re-analyze) starts with no bug highlighted
  return <Done key={analysis.updatedAt} analysis={analysis} ai={ai} onSeek={onSeek} />;
}

function NotConfigured() {
  const [copied, setCopied] = useState(false);
  // Show "Copied" for 1.4 seconds, and clean the timer up if the tab closes first.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  function copy() {
    navigator.clipboard
      ?.writeText("ANTHROPIC_API_KEY=")
      .then(() => setCopied(true))
      .catch(() => {}); // clipboard blocked: the line is still on screen to type
  }

  return (
    <div className={card}>
      <span className={iconTile}>
        <KeyIcon />
      </span>
      <p className={title}>AI summaries aren&rsquo;t set up yet</p>
      <p className={quiet}>
        Add your Claude API key to <code className="font-mono text-ink">apps/api-py/.env</code>,
        then restart the API and the worker.
      </p>
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-panel py-1.5 pr-1.5 pl-3 font-mono text-[12.5px] text-ink">
        <span className="truncate">
          ANTHROPIC_API_KEY=<em className="text-muted not-italic">sk-ant-…</em>
        </span>
        <button
          type="button"
          onClick={copy}
          className="h-7 flex-none rounded-lg bg-panel-2 px-2.5 font-sans text-xs font-semibold text-muted transition-colors hover:bg-line hover:text-ink motion-reduce:transition-none"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={quiet}>
        Get a key at console.anthropic.com. Replay only sends Claude a short text outline of the
        visit, never what people typed.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-2" aria-hidden="true">
      {[
        ["100%", "0s"],
        ["92%", "0.15s"],
        ["64%", "0.3s"],
      ].map(([width, delay]) => (
        <i
          key={width}
          className="block h-2.5 rounded-md bg-line opacity-70 motion-safe:animate-ai-pulse"
          style={{ width, animationDelay: delay }}
        />
      ))}
    </div>
  );
}

/** Seconds since `since`, ticking once a second while mounted. */
function useElapsed(since: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return secondsSince(since, now);
}

function Working({ ai, analysis }: { ai: AnalysisState; analysis: SessionAnalysis }) {
  const queued = analysis.status === "queued";
  // The API sets createdAt to "now" every time it (re)queues a run, so it marks the start of this run.
  const elapsed = useElapsed(analysis.createdAt);
  const slow = ai.timedOut || (queued && elapsed >= SLOW_HINT_S);
  const step = (label: string, state: "done" | "current" | "todo") => (
    <li
      key={label}
      aria-current={state === "current" ? "step" : undefined}
      className={`flex items-center gap-2.5 ${
        state === "done" ? "text-text" : state === "current" ? "font-medium text-ink" : "text-muted"
      }`}
    >
      <span
        className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full ${
          state === "done"
            ? "bg-violet-soft text-violet"
            : state === "current"
              ? "ring-[1.5px] ring-violet ring-inset"
              : "ring-[1.5px] ring-line ring-inset"
        }`}
      >
        {state === "done" && <CheckIcon size={11} />}
        {state === "current" && (
          <span className="h-1.5 w-1.5 rounded-full bg-violet motion-safe:animate-ai-pulse" />
        )}
      </span>
      {label}
    </li>
  );
  return (
    <>
      <div className={card}>
        <div className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
          <span>{queued ? "Waiting" : "Analysing"}</span>
          <span className={meta}>{formatElapsed(elapsed)}</span>
        </div>
        <div
          className="h-[3px] overflow-hidden rounded-[3px] bg-line"
          role="progressbar"
          aria-label="Analysing this visit"
        >
          <i className="block h-full w-2/5 rounded-[3px] bg-violet motion-safe:animate-ai-bar" />
        </div>
        <ol className="m-0 grid list-none gap-2 p-0 text-sm">
          {step("Waiting for the worker", queued ? "current" : "done")}
          {step("Claude reads the visit", queued ? "todo" : "current")}
        </ol>
        <Skeleton />
      </div>
      {slow && (
        <p className="m-0 rounded-xl bg-panel px-3 py-2.5 text-[13px] leading-[1.45] text-muted motion-safe:animate-ai-in">
          {ai.timedOut ? "Still waiting after 3 minutes? " : "Still waiting after 30 seconds? "}
          Check the worker is running:{" "}
          <code className="font-mono text-[12.5px] text-ink">npm run worker</code>
          {ai.timedOut && (
            <>
              {" "}
              <button
                type="button"
                onClick={ai.checkAgain}
                className="font-medium text-violet hover:underline"
              >
                Check again
              </button>
            </>
          )}
        </p>
      )}
      <div className="pr-1 pl-2">
        <span className={meta}>{analysis.model}</span>
      </div>
    </>
  );
}

function Done({
  analysis,
  ai,
  onSeek,
}: {
  analysis: SessionAnalysis;
  ai: AnalysisState;
  onSeek: (ms: number) => void;
}) {
  const [jumped, setJumped] = useState<number | null>(null); // which bug we last jumped to
  const bugs = sortBugs(analysis.bugs);
  const enter = (i: number) => ({ animationDelay: `${i * 40}ms` });
  return (
    <>
      <div className={card} style={enter(0)}>
        <span className="text-xs font-semibold tracking-wider text-muted uppercase">Summary</span>
        <p className="m-0 text-[14.5px] leading-[1.6] text-ink">{analysis.summary}</p>
      </div>

      {bugs.length > 0 ? (
        <>
          <h3
            className="m-0 flex items-center gap-2 px-2 pt-1.5 text-xs font-semibold tracking-wider text-muted uppercase motion-safe:animate-ai-in"
            style={enter(1)}
          >
            Possible bugs <b className="font-semibold tabular-nums">{bugs.length}</b>
          </h3>
          <ol className="m-0 grid list-none gap-1.5 p-0">
            {bugs.map((bug, i) => (
              <BugRow
                key={`${bug.title}-${i}`}
                bug={bug}
                delay={enter(i + 2)}
                current={jumped === i}
                onJump={(ms) => {
                  setJumped(i);
                  onSeek(ms);
                }}
              />
            ))}
          </ol>
        </>
      ) : (
        <div
          className="flex items-center gap-3 rounded-2xl bg-panel-2 p-3.5 motion-safe:animate-ai-in"
          style={enter(1)}
        >
          <span className={`${iconTile} bg-violet-soft text-violet`}>
            <CheckIcon />
          </span>
          <div>
            <p className="m-0 text-sm font-medium text-ink">No bugs spotted</p>
            <p className={quiet}>Nothing in this visit looks broken.</p>
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap items-center justify-between gap-2 pr-1 pl-2 motion-safe:animate-ai-in"
        style={enter(5)}
      >
        <span className={meta}>
          {[analysis.model, shortDate(analysis.updatedAt)].filter(Boolean).join(" · ")}
        </span>
        <button
          type="button"
          className={`${btnLink} ml-auto`}
          onClick={ai.start}
          disabled={ai.starting}
        >
          <RedoIcon />
          Re-analyze
        </button>
      </div>
      {ai.error && (
        <p className="m-0 px-2 text-[13px] text-accent" role="alert">
          {ai.error}
        </p>
      )}
      <p className="m-0 px-2 pb-1 text-xs text-muted motion-safe:animate-ai-in" style={enter(5)}>
        AI can be wrong. Watch the moment before you fix anything.
      </p>
    </>
  );
}

// How each severity looks: a label AND a 3-bar meter, so it never relies on colour alone.
const severity = {
  high: { label: "High", bars: 3, cls: "bg-accent-soft text-accent" },
  medium: { label: "Medium", bars: 2, cls: "text-accent ring-1 ring-accent/40 ring-inset" },
  low: { label: "Low", bars: 1, cls: "text-muted ring-1 ring-line ring-inset" },
} as const;

function BugRow(props: {
  bug: BugFlag;
  delay: { animationDelay: string };
  current: boolean;
  onJump: (ms: number) => void;
}) {
  const { bug } = props;
  const sev = severity[bug.severity];
  return (
    <li
      aria-current={props.current ? "true" : undefined}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 rounded-2xl bg-panel-2 py-3 pr-3 pl-3.5 transition-shadow duration-200 motion-safe:animate-ai-in motion-reduce:transition-none ${
        props.current ? "shadow-[inset_0_0_0_1px_var(--violet)]" : ""
      }`}
      style={props.delay}
    >
      <span
        className={`inline-flex h-[22px] w-fit items-center gap-1.5 rounded-[7px] px-2 text-[11px] font-semibold tracking-wider uppercase ${sev.cls}`}
      >
        <span className="inline-flex h-[9px] items-end gap-0.5" aria-hidden="true">
          {[4, 6.5, 9].map((h, n) => (
            <i
              key={h}
              className={`w-[3px] rounded-[1px] bg-current ${n < sev.bars ? "" : "opacity-30"}`}
              style={{ height: h }}
            />
          ))}
        </span>
        {sev.label}
      </span>
      {bug.atMs === null ? (
        <span className="font-mono text-xs text-muted">no time</span>
      ) : (
        <button
          type="button"
          onClick={() => props.onJump(bug.atMs ?? 0)}
          aria-label={`Jump to ${formatDuration(bug.atMs)}`}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-panel px-2.5 font-mono text-xs whitespace-nowrap text-ink transition hover:bg-violet-soft hover:text-violet active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" aria-hidden="true">
            <path d="M7 4v16l13-8z" />
          </svg>
          {formatDuration(bug.atMs)}
        </button>
      )}
      <h4 className="col-span-full m-0 text-sm leading-snug font-medium text-ink">{bug.title}</h4>
      <p className="col-span-full m-0 text-[13px] leading-[1.45] text-muted">{bug.evidence}</p>
    </li>
  );
}

/** "2026-10-14T14:32:00Z" → "14 Oct, 14:32" in the viewer's time zone. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "14:32" in the viewer's time zone. */
function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
