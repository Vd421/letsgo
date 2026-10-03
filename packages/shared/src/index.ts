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
