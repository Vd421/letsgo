import type { BugFlag, SessionAnalysis } from "@replay/shared";
import { describe, expect, it } from "vitest";
import {
  aiMarkerLabel,
  formatElapsed,
  hasTimedOut,
  isAiFlagged,
  isNotConfiguredError,
  isWorking,
  POLL_LIMIT_MS,
  secondsSince,
  shouldPoll,
  sortBugs,
} from "./analysis";

const bug = (severity: BugFlag["severity"], atMs: number | null): BugFlag => ({
  title: `${severity}@${atMs}`,
  severity,
  atMs,
  evidence: "",
});

describe("isWorking", () => {
  it("is true only for queued and running", () => {
    expect(isWorking("queued")).toBe(true);
    expect(isWorking("running")).toBe(true);
    expect(isWorking("done")).toBe(false);
    expect(isWorking("failed")).toBe(false);
    expect(isWorking(null)).toBe(false);
  });
});

describe("sortBugs", () => {
  it("puts worst first, then earliest, and no-time last", () => {
    const sorted = sortBugs([bug("low", 1), bug("high", null), bug("high", 500), bug("medium", 0)]);
    expect(sorted.map((b) => b.title)).toEqual(["high@500", "high@null", "medium@0", "low@1"]);
  });
  it("does not change the input", () => {
    const input = [bug("low", 1), bug("high", 2)];
    sortBugs(input);
    expect(input[0].severity).toBe("low");
  });
});

describe("AI marker", () => {
  it("labels each state", () => {
    expect(aiMarkerLabel({ aiStatus: null, aiBugCount: 0 })).toBeNull();
    expect(aiMarkerLabel({ aiStatus: "failed", aiBugCount: 0 })).toBe("failed");
    expect(aiMarkerLabel({ aiStatus: "queued", aiBugCount: 0 })).toBe("analysing");
    expect(aiMarkerLabel({ aiStatus: "done", aiBugCount: 0 })).toBe("no bugs");
    expect(aiMarkerLabel({ aiStatus: "done", aiBugCount: 1 })).toBe("1 bug");
    expect(aiMarkerLabel({ aiStatus: "done", aiBugCount: 3 })).toBe("3 bugs");
  });
  it("flags only finished analyses that found bugs", () => {
    expect(isAiFlagged({ aiStatus: "done", aiBugCount: 2 })).toBe(true);
    expect(isAiFlagged({ aiStatus: "done", aiBugCount: 0 })).toBe(false);
    expect(isAiFlagged({ aiStatus: "running", aiBugCount: 2 })).toBe(false);
  });
});

describe("shouldPoll", () => {
  const a = (status: SessionAnalysis["status"]): SessionAnalysis => ({
    sessionId: "s",
    status,
    summary: null,
    bugs: [],
    model: null,
    error: null,
    createdAt: "",
    updatedAt: "",
  });
  it("polls only while a job is in progress", () => {
    expect(shouldPoll(null)).toBe(false);
    expect(shouldPoll(a("queued"))).toBe(true);
    expect(shouldPoll(a("running"))).toBe(true);
    expect(shouldPoll(a("done"))).toBe(false);
    expect(shouldPoll(a("failed"))).toBe(false);
  });
});

describe("hasTimedOut", () => {
  it("gives up after the limit", () => {
    expect(hasTimedOut(POLL_LIMIT_MS - 1)).toBe(false);
    expect(hasTimedOut(POLL_LIMIT_MS)).toBe(true);
  });
});

describe("elapsed time", () => {
  it("counts seconds and never goes negative", () => {
    const t = Date.parse("2026-10-14T10:00:00Z");
    expect(secondsSince("2026-10-14T10:00:00Z", t + 5400)).toBe(5);
    expect(secondsSince("2026-10-14T10:00:10Z", t)).toBe(0);
    expect(secondsSince("not a date", t)).toBe(0);
  });
  it("formats m:ss", () => {
    expect(formatElapsed(5)).toBe("0:05");
    expect(formatElapsed(125)).toBe("2:05");
  });
});

describe("isNotConfiguredError", () => {
  it("is true only for a 503 that mentions the missing key", () => {
    const noKey = "AI is not configured: add ANTHROPIC_API_KEY to .env";
    expect(isNotConfiguredError(503, noKey)).toBe(true);
    expect(isNotConfiguredError(503, "Could not queue the analysis: is Redis running?")).toBe(
      false,
    );
    expect(isNotConfiguredError(500, noKey)).toBe(false);
  });
});
