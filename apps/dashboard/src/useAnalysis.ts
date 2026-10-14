// Loads the AI analysis of one visit, lets the page start it, and polls every 2 seconds while the
// background job is queued or running. Polling stops when the job ends, after 3 minutes, or when
// the page is closed.
import type { SessionAnalysis } from "@replay/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasTimedOut, isNotConfiguredError, POLL_MS, shouldPoll } from "./analysis";
import { ApiError, getAiStatus, getAnalysis, startAnalysis } from "./api";

export type AnalysisState = {
  /** undefined = loading, null = never analysed */
  analysis: SessionAnalysis | null | undefined;
  /** Is a key set up on the API? undefined = unknown (still checking, or the check failed) */
  configured: boolean | undefined;
  /** The Claude model the API will use (from /config/ai), if known */
  model: string | undefined;
  /** True once the AI-status check has finished, whether it worked or not */
  statusChecked: boolean;
  /** A short message when loading or starting failed */
  error: string | null;
  starting: boolean;
  /** We stopped polling because the job took too long (is the worker running?) */
  timedOut: boolean;
  start: () => void;
  /** After a time-out: look again and keep waiting */
  checkAgain: () => void;
};

export function useAnalysis(sessionId: string): AnalysisState {
  const [analysis, setAnalysis] = useState<SessionAnalysis | null | undefined>(undefined);
  const [configured, setConfigured] = useState<boolean | undefined>(undefined);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [statusChecked, setStatusChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Which visit is on screen right now? Answers for any other visit are thrown away.
  const currentId = useRef(sessionId);
  useEffect(() => {
    currentId.current = sessionId;
    return () => {
      currentId.current = ""; // unmounted: nothing may write state any more
    };
  }, [sessionId]);

  // Load once per visit: the current analysis and whether AI is set up.
  useEffect(() => {
    let cancelled = false; // ignore answers that arrive after we left
    setAnalysis(undefined);
    setError(null);
    setStarting(false);
    setTimedOut(false);
    setStatusChecked(false);
    getAnalysis(sessionId)
      .then((a) => !cancelled && setAnalysis(a))
      .catch(() => {
        if (cancelled) return;
        setAnalysis(null);
        setError("Couldn't load the AI analysis. Is the API running?");
      });
    getAiStatus()
      .then((s) => {
        if (cancelled) return;
        setConfigured(s.configured);
        setModel(s.model);
        setStatusChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setConfigured(undefined);
        setStatusChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Poll while the job is in progress (and we haven't given up).
  const polling = analysis !== undefined && shouldPoll(analysis) && !timedOut;
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const began = Date.now();
    const timer = setInterval(() => {
      if (hasTimedOut(Date.now() - began)) {
        setTimedOut(true);
        return;
      }
      getAnalysis(sessionId)
        .then((a) => !cancelled && setAnalysis(a))
        .catch(() => {}); // a missed poll is fine, we try again in 2 seconds
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [polling, sessionId]);

  const start = useCallback(() => {
    const id = sessionId;
    const stillHere = () => currentId.current === id;
    setStarting(true);
    setError(null);
    setTimedOut(false);
    startAnalysis(id)
      .then((a) => stillHere() && setAnalysis(a))
      .catch((e: unknown) => {
        if (!stillHere()) return;
        if (e instanceof ApiError && isNotConfiguredError(e.status, e.message))
          setConfigured(false);
        setError(e instanceof ApiError ? e.message : "Couldn't start the analysis.");
      })
      .finally(() => stillHere() && setStarting(false));
  }, [sessionId]);

  const checkAgain = useCallback(() => {
    const id = sessionId;
    setTimedOut(false); // polling starts again with a fresh 3 minutes
    getAnalysis(id)
      .then((a) => currentId.current === id && setAnalysis(a))
      .catch(() => {});
  }, [sessionId]);

  return {
    analysis,
    configured,
    model,
    statusChecked,
    error,
    starting,
    timedOut,
    start,
    checkAgain,
  };
}
