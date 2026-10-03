// Replay of one visit (address: /sessions/:id). The player itself is built in step 5;
// for now this page loads the visit's details to prove the address and the API route work.
import type { Session } from "@replay/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getSession } from "../api";
import { Card, Notice } from "../ui";

export function ReplayPage() {
  const { id = "" } = useParams(); // the ":id" part of the address
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getSession(id)
      .then(setSession)
      .catch(() => setFailed(true));
  }, [id]); // run again whenever the id in the address changes

  if (failed) {
    return (
      <Card>
        <Notice title="This visit doesn't exist">
          It may have been deleted.{" "}
          <Link to="/sessions" className="text-violet">
            Back to all visits
          </Link>
        </Notice>
      </Card>
    );
  }

  return (
    <Card>
      <Notice title={session ? `Visit to ${session.url}` : "Loading the visit…"}>
        {session && `${session.eventCount} events recorded. The replay player arrives in step 5.`}
      </Notice>
    </Card>
  );
}
