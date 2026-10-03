// The "Replay" menu item has no visit chosen, so it opens the newest one.
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { listSessions } from "../api";
import { Card, Notice } from "../ui";

export function LatestReplayPage() {
  // undefined = still loading, null = no visits yet, string = the newest visit's id
  const [newestId, setNewestId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    listSessions()
      .then((sessions) => setNewestId(sessions[0]?.id ?? null))
      .catch(() => setNewestId(null));
  }, []);

  if (newestId) return <Navigate to={`/sessions/${newestId}`} replace />;

  return (
    <Card>
      {newestId === undefined ? (
        <Notice title="Finding the newest visit…" />
      ) : (
        <Notice title="No visits to replay yet">
          Open Tiny Shop (npm run shop) and click around. Visits appear here within 5 seconds.
        </Notice>
      )}
    </Card>
  );
}
