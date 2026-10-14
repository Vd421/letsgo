// Browser tests of the AI tab and the Sessions AI column. The API (port 4000) is fully mocked
// with page.route, so there is no real API, database, Celery or Claude involved.
import { expect, test, type Page, type Route } from "@playwright/test";

const ID = "11111111-1111-4111-8111-111111111111";
const T0 = 1_700_000_000_000;
const NOW = "2026-10-14T10:00:00Z";
const CORS = { "access-control-allow-origin": "*" };

const session = (over: object = {}) => ({
  id: ID,
  url: "http://localhost:5173/",
  userAgent: "Mozilla/5.0 Edg/130",
  startedAt: NOW,
  endedAt: NOW,
  eventCount: 12,
  durationMs: 60_000,
  clickCount: 4,
  rageClickCount: 4,
  hasRage: true,
  clicks: [{ at: 42_000, rage: true }],
  aiStatus: null,
  aiBugCount: 0,
  ...over,
});

// The smallest page rrweb can replay.
const EVENTS = [
  { type: 4, timestamp: T0, data: { href: "http://localhost:5173/", width: 1000, height: 700 } },
  {
    type: 2,
    timestamp: T0 + 1,
    data: {
      node: {
        type: 0,
        id: 1,
        childNodes: [
          {
            type: 2,
            id: 2,
            tagName: "html",
            attributes: {},
            childNodes: [
              { type: 2, id: 3, tagName: "head", attributes: {}, childNodes: [] },
              {
                type: 2,
                id: 4,
                tagName: "body",
                attributes: {},
                childNodes: [
                  {
                    type: 2,
                    id: 5,
                    tagName: "button",
                    attributes: {},
                    childNodes: [{ type: 3, id: 6, textContent: "Checkout" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      initialOffset: { top: 0, left: 0 },
    },
  },
  {
    type: 3,
    timestamp: T0 + 60_000,
    data: { source: 1, positions: [{ x: 1, y: 1, id: 4, timeOffset: 0 }] },
  },
];

const analysis = (over: object = {}) => ({
  sessionId: ID,
  status: "done",
  summary: "The visitor filled in the form but checkout never completed.",
  bugs: [
    {
      title: "Checkout button does nothing",
      severity: "high",
      atMs: 42_000 as number | null,
      evidence: "Four clicks in two seconds and the page never changed.",
    },
  ],
  model: "claude-haiku-5-5",
  error: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const queued = () => analysis({ status: "queued", summary: null, bugs: [] });

type Mock = {
  configured?: boolean;
  analysis?: () => object | null; // null = 404
  post?: (route: Route) => Promise<void>;
  sessions?: object[];
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });

async function mockApi(page: Page, m: Mock = {}) {
  const posts: string[] = [];
  await page.route("http://localhost:4000/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...CORS,
          "access-control-allow-methods": "*",
          "access-control-allow-headers": "*",
        },
      });
    }
    if (path === "/config/ai") {
      return json(route, { configured: m.configured ?? true, model: "claude-haiku-5-5" });
    }
    if (path === `/sessions/${ID}/analysis`) {
      if (req.method() === "POST") {
        posts.push(path);
        return m.post ? m.post(route) : json(route, queued(), 202);
      }
      const a = m.analysis ? m.analysis() : null;
      return a ? json(route, a) : json(route, { detail: "not found" }, 404);
    }
    if (path === `/sessions/${ID}/events`) return json(route, EVENTS);
    if (path === `/sessions/${ID}`) return json(route, session());
    if (path === "/sessions") return json(route, m.sessions ?? [session()]);
    return json(route, { detail: "unexpected" }, 500);
  });
  return posts;
}

const openAiTab = async (page: Page) => {
  await page.goto(`/sessions/${ID}`);
  await page.getByRole("tab", { name: /^AI/ }).click();
};

test("not configured: explains the API key and offers Copy", async ({ page }) => {
  const posts = await mockApi(page, { configured: false });
  await openAiTab(page);
  await expect(page.getByText(/AI summaries aren.t set up yet/)).toBeVisible();
  await expect(page.getByText("ANTHROPIC_API_KEY=").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze visit" })).toHaveCount(0);
  expect(posts).toHaveLength(0);
});

test("never analysed: Analyze visit queues, polls, then shows summary and bugs", async ({
  page,
}) => {
  let status = "none";
  const posts = await mockApi(page, {
    analysis: () => {
      if (status === "none") return null;
      return status === "done" ? analysis() : analysis({ status, summary: null, bugs: [] });
    },
    post: async (route) => {
      status = "queued";
      await json(route, queued(), 202);
    },
  });
  await openAiTab(page);
  await page.getByRole("button", { name: "Analyze visit" }).click();
  await expect(page.getByRole("progressbar")).toBeVisible();
  expect(posts).toHaveLength(1);
  status = "done"; // the "worker" finishes; the next 2 s poll picks it up
  await expect(page.getByText("checkout never completed")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Checkout button does nothing")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jump to 0:42" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("done: tab shows the bug count and Jump to works", async ({ page }) => {
  await mockApi(page, { analysis: () => analysis() });
  await openAiTab(page);
  await expect(page.getByRole("tab", { name: /AI/ })).toContainText("1");
  await page.getByRole("button", { name: "Jump to 0:42" }).click();
  await expect(page.getByText("0:42").first()).toBeVisible();
});

test("done with no bugs: says nothing looks broken", async ({ page }) => {
  await mockApi(page, { analysis: () => analysis({ bugs: [] }) });
  await openAiTab(page);
  await expect(page.getByText("No bugs spotted")).toBeVisible();
  await expect(page.getByRole("button", { name: /Jump to/ })).toHaveCount(0);
});

test("bug without a time has no Jump button", async ({ page }) => {
  const a = analysis();
  a.bugs[0].atMs = null;
  await mockApi(page, { analysis: () => a });
  await openAiTab(page);
  await expect(page.getByText("Checkout button does nothing")).toBeVisible();
  await expect(page.getByRole("button", { name: /Jump to/ })).toHaveCount(0);
});

test("failed: shows the safe error and Retry posts again", async ({ page }) => {
  const posts = await mockApi(page, {
    analysis: () =>
      analysis({
        status: "failed",
        summary: null,
        bugs: [],
        error: "The AI is busy or slow right now",
      }),
  });
  await openAiTab(page);
  await expect(page.getByText(/analyse this visit/)).toBeVisible();
  await expect(page.getByText("The AI is busy or slow right now")).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => posts.length).toBe(1);
});

test("503 on start (key missing) switches to the set-up instructions", async ({ page }) => {
  await mockApi(page, {
    post: (route) =>
      json(route, { detail: "AI is not configured: add ANTHROPIC_API_KEY to .env" }, 503),
  });
  await openAiTab(page);
  await page.getByRole("button", { name: "Analyze visit" }).click();
  await expect(page.getByText(/AI summaries aren.t set up yet/)).toBeVisible();
});

test("analysis request fails: AI tab shows a load error instead of crashing", async ({ page }) => {
  await mockApi(page);
  await page.route(`http://localhost:4000/sessions/${ID}/analysis`, (r) => r.abort());
  await openAiTab(page);
  await expect(page.getByText(/load the AI analysis/).first()).toBeVisible();
});

test("Sessions page: AI column, bug marker and the AI flagged filter", async ({ page }) => {
  const other = "22222222-2222-4222-8222-222222222222";
  await mockApi(page, {
    sessions: [
      session({ aiStatus: "done", aiBugCount: 2 }),
      session({ id: other, hasRage: false, rageClickCount: 0, aiStatus: null }),
    ],
  });
  await page.goto("/sessions");
  await expect(page.getByRole("columnheader", { name: "AI" })).toBeVisible();
  await expect(page.getByText(/2 bugs/).first()).toBeVisible();
  await expect(page.getByLabel("Not analysed")).toHaveCount(1);
  await page.getByRole("button", { name: /AI flagged/ }).click();
  await expect(page.getByLabel("Not analysed")).toHaveCount(0);
  await expect(page.getByText(/2 bugs/).first()).toBeVisible();
});
