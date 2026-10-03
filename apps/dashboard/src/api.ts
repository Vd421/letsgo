// Every call the dashboard makes to the Python API lives here, in one place.
// The return types come from @replay/shared, so TypeScript knows exactly what each answer contains.
import type { SessionSummary } from "@replay/shared";
import type { eventWithTime } from "@rrweb/types";

export const API_URL = "http://localhost:4000";

// Ask the API for something and turn the JSON answer into data.
// Throws an error if the API answers with a failure (e.g. 404), so callers can show a message.
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status} for ${path}`);
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
