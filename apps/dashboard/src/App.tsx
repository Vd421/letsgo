// Our first component. For now: a title, a check that the Python API can be reached,
// and how many visits have been recorded.
import type { Session } from "@replay/shared";
import { useEffect, useState } from "react";
import { isApiHealthy, listSessions } from "./api";

// The three states the API check can be in. TypeScript only allows these exact words.
type ApiStatus = "checking" | "connected" | "unreachable";

export default function App() {
  // State: remember the API status, starting with "checking". Changing it redraws the page.
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  // State: the recorded sessions. null = "not loaded yet".
  const [sessions, setSessions] = useState<Session[] | null>(null);

  // useEffect: run this AFTER the page first appears. The empty [] at the end means "only once".
  useEffect(() => {
    isApiHealthy().then((healthy) => setApiStatus(healthy ? "connected" : "unreachable"));
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-5xl font-bold">Random dashboard</h1>
      <p className="mt-2 text-blue-400">Recorded visits will appear here.</p>

      <p className="mt-6 rounded-lg bg-white p-4 shadow">
        {apiStatus === "checking" && "Checking the API…"}
        {apiStatus === "connected" && "API connected ✅"}
        {apiStatus === "unreachable" && "API not reachable ❌ Is it running on port 4000?"}
      </p>

      <p className="mt-4 rounded-lg bg-white p-4 shadow">
        {sessions === null ? "Loading sessions…" : `${sessions.length} visits recorded`}
      </p>
    </main>
  );
}
