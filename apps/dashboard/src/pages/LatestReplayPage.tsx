// The "Replay" menu item has no visit chosen, so it opens the newest visit that can be replayed.
// Visits with almost no events (the visitor left before the first batch was sent) are skipped.
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { listSessions } from "../api";
import { Card, Notice } from "../ui";
import { isReplayable } from "../useSessions";

export function LatestReplayPage() {
  // undefined = still loading, null = nothing replayable yet, string = the visit to open
  const [targetId, setTargetId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    listSessions()
      .then((sessions) => setTargetId(sessions.find(isReplayable)?.id ?? null))
      .catch(() => setTargetId(null));
  }, []);

  if (targetId) return <Navigate to={`/sessions/${targetId}`} replace />;

  return (
    <Card>
      {targetId === undefined ? (
        <Notice title="Finding the newest visit…" />
      ) : (
        <Notice title="No visits to replay yet">
          Open Tiny Shop (npm run shop) and click around. Visits appear here within 5 seconds.
        </Notice>
      )}
    </Card>
  );
}
