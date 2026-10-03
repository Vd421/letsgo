// Tests for computeStats (the maths behind the Overview page).
import type { SessionSummary } from "@replay/shared";
import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";

let nextId = 0;
/** A made-up visit. Only the fields a test cares about need to be given. */
function visit(fields: Partial<SessionSummary> & { started?: Date }): SessionSummary {
  const { started = new Date(2026, 9, 3, 22, 11), ...rest } = fields;
  nextId += 1;
  return {
    id: `visit-${nextId}`,
    url: "http://localhost:5173/",
    userAgent: null,
    startedAt: started.toISOString(),
    endedAt: null,
    eventCount: 20,
    durationMs: 10_000,
    clickCount: 2,
    rageClickCount: 0,
    hasRage: false,
    clicks: [],
    ...rest,
  };
}

const NOW = new Date(2026, 9, 4, 12, 0); // Sunday 4 Oct 2026, midday

describe("computeStats", () => {
  it("handles no visits at all without dividing by zero", () => {
    const stats = computeStats([], NOW);

    expect(stats.visits).toBe(0);
    expect(stats.ragePercent).toBe(0);
    expect(stats.avgEvents).toBe(0);
    expect(stats.longestDurationMs).toBe(0);
  });

  it("counts visits, rage visits and percentages", () => {
    const stats = computeStats(
      [
        visit({ hasRage: true, rageClickCount: 5 }),
        visit({ hasRage: true, rageClickCount: 4 }),
        visit({}),
        visit({}),
      ],
      NOW,
    );

    expect(stats.visits).toBe(4);
    expect(stats.rageVisits).toBe(2);
    expect(stats.calmVisits).toBe(2);
    expect(stats.ragePercent).toBe(50);
    expect(stats.rageClicks).toBe(9);
  });

  it("leaves empty visits out of the numbers but counts them separately", () => {
    const stats = computeStats(
      [visit({ eventCount: 0 }), visit({ eventCount: 2 }), visit({})],
      NOW,
    );

    expect(stats.visits).toBe(1);
    expect(stats.emptyVisits).toBe(2);
  });

  it("works out totals, averages and the longest visit", () => {
    const stats = computeStats(
      [
        visit({ eventCount: 10, durationMs: 1_000 }),
        visit({ eventCount: 20, durationMs: 2_000 }),
        visit({ eventCount: 31, durationMs: 9_000 }),
      ],
      NOW,
    );

    expect(stats.events).toBe(61);
    expect(stats.avgEvents).toBe(20); // 61 / 3 = 20.3, rounded
    expect(stats.avgDurationMs).toBe(4_000);
    expect(stats.longestDurationMs).toBe(9_000);
  });

  it("counts today's visits", () => {
    const stats = computeStats(
      [
        visit({ started: new Date(2026, 9, 4, 9, 0) }),
        visit({ started: new Date(2026, 9, 3, 23, 0) }),
      ],
      NOW,
    );

    expect(stats.visitsToday).toBe(1);
  });

  it("puts each visit in the right heatmap square (weekday × 4-hour block)", () => {
    const saturdayNight = new Date(2026, 9, 3, 22, 11); // Saturday, 20–24 block
    const sundayEarly = new Date(2026, 9, 4, 1, 5); // Sunday, 00–04 block
    const stats = computeStats(
      [
        visit({ started: saturdayNight }),
        visit({ started: saturdayNight }),
        visit({ started: sundayEarly }),
      ],
      NOW,
    );

    const SAT = 5;
    const SUN = 6;
    expect(stats.heatmap[5][SAT]).toBe(2);
    expect(stats.heatmap[0][SUN]).toBe(1);
    const total = stats.heatmap.flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(3);
  });

  it("gives the chart the latest visits, oldest first", () => {
    // The API sends newest first.
    const newestFirst = [visit({ id: "c" }), visit({ id: "b" }), visit({ id: "a" })];

    const stats = computeStats(newestFirst, NOW, 2);

    expect(stats.recent.map((v) => v.id)).toEqual(["b", "c"]);
  });
});
