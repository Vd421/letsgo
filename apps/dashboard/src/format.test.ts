// Tests for the text helpers in format.ts. Run with: npm test
import { describe, expect, it } from "vitest";
import { browserName, formatClock, formatDuration, formatTime, shortUrl } from "./format";

describe("browserName", () => {
  it("names common browsers from their long user-agent text", () => {
    const edge =
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/150.0 Safari/537.36 Edg/150.0";
    const chrome = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/150.0 Safari/537.36";
    const firefox = "Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0";
    expect(browserName(edge)).toBe("Edge"); // Edge also says "Chrome", so order matters
    expect(browserName(chrome)).toBe("Chrome");
    expect(browserName(firefox)).toBe("Firefox");
  });

  it("spots VS Code's built-in browser and test robots", () => {
    expect(browserName("Mozilla/5.0 Code/1.140.0 Chrome/150.0 Electron/43.7.3")).toBe("VS Code");
    expect(browserName("Mozilla/5.0 HeadlessChrome/154.0.0.0 Safari/537.36")).toBe("Test robot");
  });

  it("handles a missing user agent", () => {
    expect(browserName(null)).toBe("Unknown");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [9_043, "0:09"],
    [95_000, "1:35"],
    [6_413_000, "1:46:53"], // over an hour gets hours
  ])("%i ms → %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe("formatClock", () => {
  it("shows tenths of a second for short visits", () => {
    expect(formatClock(1_400, 2_000)).toBe("0:01.4");
  });

  it("drops the tenths once a visit is a minute or longer", () => {
    expect(formatClock(1_400, 95_000)).toBe("0:01");
  });
});

describe("formatTime", () => {
  it("shows the time in the viewer's own time zone", () => {
    // Built in local time, so this passes in any time zone (including GitHub's, which is UTC).
    const tenPastTen = new Date(2026, 9, 3, 22, 10).toISOString();
    expect(formatTime(tenPastTen)).toBe("22:10");
  });
});

describe("shortUrl", () => {
  it("keeps the site and path, drops the protocol and query", () => {
    expect(shortUrl("http://localhost:5173/")).toBe("localhost:5173");
    expect(shortUrl("https://shop.example.com/cart?item=4")).toBe("shop.example.com/cart");
  });

  it("returns text that isn't a URL unchanged", () => {
    expect(shortUrl("not a url")).toBe("not a url");
  });
});
