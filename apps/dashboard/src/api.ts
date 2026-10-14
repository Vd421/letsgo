// Every call the dashboard makes to the Python API lives here, in one place.
// The return types come from @replay/shared, so TypeScript knows exactly what each answer contains.
import type { AiStatus, SessionAnalysis, SessionSummary } from "@replay/shared";
import type { eventWithTime } from "@rrweb/types";

export const API_URL = "http://localhost:4000";

/** An API failure that remembers the HTTP status and the API's own message (if it sent one). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Ask the API for something and turn the JSON answer into data.
// Throws an ApiError if the API answers with a failure (e.g. 404), so callers can show a message.
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new ApiError(response.status, `API error ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

/** Is the API running? True if GET /health answers OK. */
export async function isApiHealthy(): Promise<boolean> {
  try {
    await getJson<{ status: string }>("/health");
    return true;
  } catch {
    return false; // not running, or CORS blocked us
  }
}

/** All recorded sessions, newest first, each with its click analysis. */
export function listSessions(): Promise<SessionSummary[]> {
  return getJson<SessionSummary[]>("/sessions");
}

/** One session's details and analysis. Throws if it doesn't exist (404). */
export function getSession(id: string): Promise<SessionSummary> {
  return getJson<SessionSummary>(`/sessions/${id}`);
}

/** Everything rrweb recorded for one visit, oldest first. This is what the replay plays. */
export function getEvents(id: string): Promise<eventWithTime[]> {
  return getJson<eventWithTime[]>(`/sessions/${id}/events`);
}

/** Is Claude set up (is there an API key)? The AI tab uses this to explain how to add one. */
export function getAiStatus(): Promise<AiStatus> {
  return getJson<AiStatus>("/config/ai");
}

/** The AI analysis of a visit, or null if nobody has analysed it yet (the API answers 404). */
export async function getAnalysis(id: string): Promise<SessionAnalysis | null> {
  try {
    return await getJson<SessionAnalysis>(`/sessions/${id}/analysis`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Ask Claude to analyse a visit (queues a background job) and return the "queued" analysis.
 * If it is already queued or running (409) we get the current one back.
 * Throws ApiError otherwise, e.g. 503 when no ANTHROPIC_API_KEY is set.
 */
export async function startAnalysis(id: string): Promise<SessionAnalysis> {
  const response = await fetch(`${API_URL}/sessions/${id}/analysis`, { method: "POST" });
  if (response.ok || response.status === 409) return (await response.json()) as SessionAnalysis;
  let message = `API error ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") message = body.detail;
  } catch {
    // the answer wasn't JSON: keep the generic message
  }
  throw new ApiError(response.status, message);
}
