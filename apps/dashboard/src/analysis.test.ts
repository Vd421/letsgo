import type { BugFlag, SessionAnalysis } from "@replay/shared";
import { describe, expect, it } from "vitest";
import {
  aiMarkerLabel,
  hasTimedOut,
  isAiFlagged,
  isWorking,
  POLL_LIMIT_MS,
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
    expect(aiMarkerLabel({ aiStatus: "failed", aiBugCount: 0 })).toBeNull();
    expect(aiMarkerLabel({ aiStatus: "queued", aiBugCount: 0 })).toBe("AI analysing…");
    expect(aiMarkerLabel({ aiStatus: "done", aiBugCount: 0 })).toBe("AI: no bugs");
    expect(aiMarkerLabel({ aiStatus: "done", aiBugCount: 1 })).toBe("AI: 1 bug");
    expect(aiMarkerLabel({ aiStatus: "done", aiBugCount: 3 })).toBe("AI: 3 bugs");
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
