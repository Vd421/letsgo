// Small pure helpers for the AI analysis (kept separate from React so they are easy to test).
import type { AnalysisStatus, BugFlag, BugSeverity, SessionAnalysis } from "@replay/shared";

/** How often we ask the API for news while the AI is working. */
export const POLL_MS = 2000;

/** Is the job still in progress? Then the screen should keep polling. */
export function isWorking(status: AnalysisStatus | null | undefined): boolean {
  return status === "queued" || status === "running";
}

/** Should we poll? Only while a job is in progress. */
export function shouldPoll(analysis: SessionAnalysis | null): boolean {
  return analysis !== null && isWorking(analysis.status);
}

const severityRank: Record<BugSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Worst bugs first; bugs of equal severity keep the order of when they happen in the visit. */
export function sortBugs(bugs: BugFlag[]): BugFlag[] {
  return [...bugs].sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      (a.atMs ?? Infinity) - (b.atMs ?? Infinity),
  );
}

type AiFields = { aiStatus: AnalysisStatus | null; aiBugCount: number };

/** True when the analysis is done and found at least one bug (used by the "AI flagged" filter). */
export function isAiFlagged(s: AiFields): boolean {
  return s.aiStatus === "done" && s.aiBugCount > 0;
}

/** Words after "AI ·" in the Sessions table; null = never analysed. */
export function aiMarkerLabel(s: AiFields): string | null {
  if (isWorking(s.aiStatus)) return "analysing";
  if (s.aiStatus === "failed") return "failed";
  if (s.aiStatus !== "done") return null;
  if (s.aiBugCount === 0) return "no bugs";
  return `${s.aiBugCount} ${s.aiBugCount === 1 ? "bug" : "bugs"}`;
}

/** Stop polling after this long and tell the visitor, in case the worker isn't running. */
export const POLL_LIMIT_MS = 3 * 60 * 1000;

/** Has the job been in progress for longer than we are willing to wait? */
export function hasTimedOut(waitedMs: number): boolean {
  return waitedMs >= POLL_LIMIT_MS;
}

/** Seconds since an ISO time, never negative (the clocks of browser and server may differ a bit). */
export function secondsSince(iso: string, now: number): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 1000));
}

/** 5 → "0:05", 125 → "2:05". */
export function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Queued for this long? Then we hint that the worker may not be running. */
export const SLOW_HINT_S = 30;

/** A 503 means "AI isn't set up" only when the API says the key is missing (Redis being down is also a 503). */
export function isNotConfiguredError(status: number, message: string): boolean {
  return status === 503 && message.includes("ANTHROPIC_API_KEY");
}
