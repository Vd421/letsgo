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

/** Text for the small marker in the Sessions table, or null if there is nothing to show. */
export function aiMarkerLabel(s: AiFields): string | null {
  if (isWorking(s.aiStatus)) return "AI analysing…";
  if (s.aiStatus !== "done") return null;
  if (s.aiBugCount === 0) return "AI: no bugs";
  return `AI: ${s.aiBugCount} ${s.aiBugCount === 1 ? "bug" : "bugs"}`;
}

/** Stop polling after this long and tell the visitor, in case the worker isn't running. */
export const POLL_LIMIT_MS = 3 * 60 * 1000;

/** Has the job been in progress for longer than we are willing to wait? */
export function hasTimedOut(waitedMs: number): boolean {
  return waitedMs >= POLL_LIMIT_MS;
}
