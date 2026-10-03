// Tests for buildMoments: turning raw rrweb events into the readable "Moments" story.
import type { SessionSummary } from "@replay/shared";
import { describe, expect, it } from "vitest";
import { buildMoments } from "./moments";

const T0 = 1_000_000; // made-up start time (ms)

// A tiny page, written the way rrweb's full snapshot describes it:
// <html>(1) <body>(2) <button>(10)"Add to cart" <button>(41)"Checkout" <input type=email>(50)
const snapshot = {
  type: 2,
  timestamp: T0,
  data: {
    node: {
      id: 1,
      type: 2,
      tagName: "html",
      childNodes: [
        {
          id: 2,
          type: 2,
          tagName: "body",
          childNodes: [
            {
              id: 10,
              type: 2,
              tagName: "button",
              childNodes: [{ id: 11, type: 3, textContent: "Add to cart" }],
            },
            {
              id: 41,
              type: 2,
              tagName: "button",
              childNodes: [{ id: 42, type: 3, textContent: "Checkout" }],
            },
            { id: 50, type: 2, tagName: "input", attributes: { type: "email" }, childNodes: [] },
          ],
        },
      ],
    },
  },
};
const meta = {
  type: 4,
  timestamp: T0,
  data: { href: "http://localhost:5173/", width: 1280, height: 720 },
};
const click = (at: number, id: number) => ({
  type: 3,
  timestamp: T0 + at,
  data: { source: 2, type: 2, id },
});
const typed = (at: number, id: number) => ({
  type: 3,
  timestamp: T0 + at,
  data: { source: 5, id, text: "***" },
});

function summary(rageFlags: boolean[]): SessionSummary {
  return {
    id: "v",
    url: "http://localhost:5173/",
    userAgent: null,
    startedAt: new Date(T0).toISOString(),
    endedAt: null,
    eventCount: 0,
    durationMs: 0,
    clickCount: rageFlags.length,
    rageClickCount: rageFlags.filter(Boolean).length,
    hasRage: rageFlags.some(Boolean),
    clicks: rageFlags.map((rage) => ({ at: 0, rage })),
  };
}

describe("buildMoments", () => {
  it("returns nothing for a visit with no events", () => {
    expect(buildMoments([], summary([]))).toEqual([]);
  });

  it("names clicked buttons by their text", () => {
    const events = [meta, snapshot, click(1000, 10), click(2000, 41)];

    const titles = buildMoments(events, summary([false, false])).map((m) => m.title);

    expect(titles).toEqual([
      "Opened localhost:5173",
      'Clicked "Add to cart"',
      'Clicked "Checkout"',
      "Recording ended",
    ]);
  });

  it("joins a burst of rage clicks into one moment with a count", () => {
    const events = [
      meta,
      snapshot,
      click(1000, 10),
      ...[3000, 3500, 4000, 4500].map((t) => click(t, 41)),
    ];

    const moments = buildMoments(events, summary([false, true, true, true, true]));
    const rage = moments.filter((m) => m.kind === "rage");

    expect(rage).toHaveLength(1);
    expect(rage[0].title).toBe('Rage click on "Checkout"');
    expect(rage[0].detail).toBe("4 clicks in 1.5 s. The page didn't react.");
    expect(rage[0].at).toBe(3000);
  });

  it("joins typing in one box into one moment and keeps it private", () => {
    const events = [meta, snapshot, typed(1000, 50), typed(1200, 50), typed(1400, 50)];

    const typing = buildMoments(events, summary([])).filter((m) => m.kind === "type");

    expect(typing).toHaveLength(1);
    expect(typing[0].title).toBe("Typed in the email box");
    expect(typing[0].detail).toContain("hidden");
  });

  it("calls a click on the page background 'an empty part of the page'", () => {
    const events = [meta, snapshot, click(1000, 2)]; // id 2 = <body>

    const titles = buildMoments(events, summary([false])).map((m) => m.title);

    expect(titles).toContain("Clicked an empty part of the page");
  });

  it("finds buttons that were added to the page later (e.g. a cart's Remove button)", () => {
    const addRemoveButton = {
      type: 3,
      timestamp: T0 + 500,
      data: {
        source: 0,
        adds: [
          {
            parentId: 2,
            node: {
              id: 60,
              type: 2,
              tagName: "button",
              childNodes: [{ id: 61, type: 3, textContent: "Remove" }],
            },
          },
        ],
      },
    };

    const events = [meta, snapshot, addRemoveButton, click(1000, 60)];

    expect(buildMoments(events, summary([false])).map((m) => m.title)).toContain(
      'Clicked "Remove"',
    );
  });
});
