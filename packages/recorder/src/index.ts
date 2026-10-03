// The recorder: a website calls startRecording() once, and from then on everything the
// visitor does (clicks, scrolls, typing, page changes) is recorded with rrweb and sent to
// our API in small batches.
import type { Session, SessionCreate } from "@replay/shared";
import { record } from "rrweb";

export type RecorderOptions = {
  apiUrl: string; // where our API lives, e.g. "http://localhost:4000"
  flushEveryMs?: number; // how often to send a batch (default: every 5 seconds)
};

export type Recording = {
  sessionId: string;
  stop: () => void;
};

// The API accepts at most 1000 events per batch, so bigger piles are sent in parts.
const MAX_EVENTS_PER_BATCH = 1000;

export async function startRecording(options: RecorderOptions): Promise<Recording> {
  const { apiUrl, flushEveryMs = 5000 } = options;

  // 1. Tell the API a new visit started. It replies with the new session (and its ID).
  const newSession: SessionCreate = {
    url: location.href,
    userAgent: navigator.userAgent.slice(0, 500), // the API allows max 500 characters
  };
  const response = await fetch(`${apiUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newSession),
  });
  if (!response.ok) {
    throw new Error(`Replay: could not start a session (status ${response.status})`);
  }
  const { id: sessionId } = (await response.json()) as Session;

  // 2. rrweb calls emit() for every change on the page. We collect events in a pile (the buffer).
  let buffer: unknown[] = [];
  const stopRrweb = record({
    emit(event) {
      buffer.push(event);
    },
    // Privacy: record THAT someone typed, but replace what they typed with ****.
    // Emails, passwords and card numbers never leave the visitor's browser.
    maskAllInputs: true,
  });

  // 3. Send the pile to the API, then start a new, empty pile.
  // keepalive = "finish sending even if the page is closing".
  function flush(keepalive = false): void {
    const events = buffer;
    buffer = [];
    for (let i = 0; i < events.length; i += MAX_EVENTS_PER_BATCH) {
      fetch(`${apiUrl}/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: events.slice(i, i + MAX_EVENTS_PER_BATCH) }),
        keepalive,
      }).catch((error) => console.warn("Replay: could not send events", error));
    }
  }

  // Send a batch every few seconds, and one last batch when the visitor leaves the page.
  const timer = setInterval(flush, flushEveryMs);
  const onLeave = () => flush(true);
  addEventListener("pagehide", onLeave);

  return {
    sessionId,
    stop() {
      clearInterval(timer);
      removeEventListener("pagehide", onLeave);
      stopRrweb?.();
      flush();
    },
  };
}
