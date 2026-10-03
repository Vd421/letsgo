// Loads all visits from the API and refreshes them every 10 seconds.
// Shared by the Overview and Sessions pages, so both behave the same way.
import type { SessionSummary } from "@replay/shared";
import { useCallback, useEffect, useState } from "react";
import { listSessions } from "./api";

const REFRESH_MS = 10_000;

export function useSessions() {
  // undefined = still loading, null = the API couldn't be reached
  const [sessions, setSessions] = useState<SessionSummary[] | null | undefined>(undefined);

  const reload = useCallback(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setSessions(null));
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer); // stop refreshing when the page is closed
  }, [reload]);

  return { sessions, reload };
}

/** Enough was recorded to rebuild the page: page info + a full snapshot (+ at least one change). */
export function isReplayable(session: SessionSummary): boolean {
  return session.eventCount >= 3;
}
