// Shapes of the data our Python API sends and receives, described once and shared by every
// TypeScript app (dashboard, recorder). They must match apps/api-py/app/schemas.py.

/** One recorded visit to a website (what GET /sessions returns a list of). */
export type Session = {
  id: string;
  url: string; // page where the recording started
  userAgent: string | null; // visitor's browser info, if sent
  startedAt: string; // date as text (JSON has no date type), e.g. "2026-10-03T16:35:24Z"
  endedAt: string | null; // null while the visit is still going
  eventCount: number; // recorded events saved so far
};

/** One click, for the "clicks over time" strip. */
export type ClickMark = {
  at: number; // where in the visit: 0 = start, 1 = end
  rage: boolean; // part of a rage-click burst (repeated clicks the page didn't react to)
};

/** A session plus what the API worked out from its events (GET /sessions, GET /sessions/{id}). */
export type SessionSummary = Session & {
  durationMs: number;
  clickCount: number;
  rageClickCount: number;
  hasRage: boolean;
  clicks: ClickMark[];
  aiStatus: AnalysisStatus | null; // null = this visit was never analysed by the AI
  aiBugCount: number; // bugs the AI flagged (0 until the analysis is done)
};

/** What POST /sessions expects. */
export type SessionCreate = {
  url: string;
  userAgent?: string; // "?" = optional: may be left out entirely
};

/** What POST /sessions/{id}/events replies after saving a batch. */
export type EventBatchSaved = {
  received: number; // events in this batch
  eventCount: number; // events saved for this session so far, in total
};

/** Where an AI analysis is: waiting in the queue, being worked on, finished, or broken. */
export type AnalysisStatus = "queued" | "running" | "done" | "failed";

export type BugSeverity = "low" | "medium" | "high";

/** One likely bug the AI spotted in a visit. */
export type BugFlag = {
  title: string; // short, e.g. "Checkout button does nothing"
  severity: BugSeverity;
  atMs: number | null; // ms from the visit start where it shows, so the player can jump there
  evidence: string; // 1-2 sentences: what in the visit suggests it
};

/** The AI's verdict on one visit (POST/GET /sessions/{id}/analysis). */
export type SessionAnalysis = {
  sessionId: string;
  status: AnalysisStatus;
  summary: string | null; // 2-4 plain sentences, null until done
  bugs: BugFlag[]; // empty until done
  model: string | null; // which Claude model wrote it
  error: string | null; // short, safe message when status is "failed"
  createdAt: string;
  updatedAt: string;
};

/** What GET /config/ai replies, so the dashboard knows whether the AI button can work. */
export type AiStatus = {
  configured: boolean; // false = no ANTHROPIC_API_KEY in .env
  model: string; // the Claude model that will be used
};
