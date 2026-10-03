// Turns a visit's raw rrweb events into a short story ("Moments") a person can read:
// "Opened localhost:5173" → "Clicked 'Add to cart'" → "Rage click on 'Checkout'" → ...
//
// rrweb only says "click on element 76". To say *which* button that was, we build our own small
// index of the page from the same data the replay uses: the full page snapshot, plus every
// element added later (e.g. cart lines). Then element 76 → a <button> whose text is "Checkout".
import type { SessionSummary } from "@replay/shared";
import { shortUrl } from "../format";

// rrweb's numbers for event kinds (from @rrweb/types), written out so this file reads plainly.
const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const META = 4;
const MUTATION = 0;
const MOUSE_INTERACTION = 2;
const CLICK = 2;
const INPUT = 5;
const ELEMENT_NODE = 2;
const TEXT_NODE = 3;

export type MomentKind = "page" | "click" | "type" | "rage" | "end";
export type Moment = { at: number; kind: MomentKind; title: string; detail: string };

/** The parts of an rrweb event this file reads. */
type RawEvent = { type: number; timestamp: number; data?: unknown };
type SnapshotNode = {
  id: number;
  type: number;
  tagName?: string;
  textContent?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SnapshotNode[];
};
type IndexedNode = {
  tag?: string;
  text?: string;
  attrs: Record<string, unknown>;
  children: number[];
};

const RAGE_GAP_MS = 2000; // rage clicks closer together than this belong to one burst
const TYPING_GAP_MS = 2000; // typing in the same box with pauses shorter than this = one moment

/** A small map of the page: element id → its tag, text and children. */
class PageIndex {
  private nodes = new Map<number, IndexedNode>();

  add(node: SnapshotNode, parentId?: number) {
    this.nodes.set(node.id, {
      tag: node.type === ELEMENT_NODE ? node.tagName : undefined,
      text: node.type === TEXT_NODE ? node.textContent : undefined,
      attrs: node.attributes ?? {},
      children: [],
    });
    if (parentId !== undefined) this.nodes.get(parentId)?.children.push(node.id);
    for (const child of node.childNodes ?? []) this.add(child, node.id);
  }

  private textOf(id: number, depth = 0): string {
    const node = this.nodes.get(id);
    if (!node || depth > 6) return "";
    if (node.text !== undefined) return node.text;
    return node.children.map((c) => this.textOf(c, depth + 1)).join(" ");
  }

  /** A human name for a clicked/typed-in element, e.g. "Checkout" or "the email box". */
  describe(id: number | undefined): string {
    if (id === undefined) return "the page";
    const node = this.nodes.get(id);
    if (node?.tag === "input" || node?.tag === "textarea") {
      const kind = String(node.attrs.type ?? "text");
      return kind === "email"
        ? "the email box"
        : kind === "password"
          ? "the password box"
          : "a text box";
    }
    // Keep only letters/numbers/punctuation people read (drops emoji), squash spaces, keep it short.
    const text = this.textOf(id)
      .replace(/[^\p{L}\p{N}\s.,:$'&()-]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    // Clicking the page's background lands on <html>/<body>, whose "text" is the whole page.
    if (node?.tag === "html" || node?.tag === "body") return "an empty part of the page";
    // A big box with lots of text inside (not a button or link) → name the box, not its text.
    const clickable = ["button", "a", "label", "summary", "option"].includes(node?.tag ?? "");
    if (text.length > 40 && !clickable) return `an empty part of the page`;
    if (text) return `"${text.length > 28 ? `${text.slice(0, 27)}…` : text}"`;
    return node?.tag ? `a ${node.tag} element` : "the page";
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function buildMoments(events: RawEvent[], summary: SessionSummary): Moment[] {
  if (events.length === 0) return [];
  const start = events[0].timestamp;
  const index = new PageIndex();
  const moments: Moment[] = [];
  let clickNumber = 0; // matches the order of summary.clicks (the API's analysis)
  let rageBurst: { moment: Moment; count: number; firstAt: number; lastAt: number } | null = null;
  let typing: { moment: Moment; target: unknown; lastAt: number } | null = null;

  for (const event of events) {
    const at = event.timestamp - start;
    const data = record(event.data);

    if (event.type === FULL_SNAPSHOT) {
      index.add(data.node as SnapshotNode);
    } else if (event.type === META && typeof data.href === "string") {
      const first = moments.length === 0;
      moments.push({
        at,
        kind: "page",
        title: `${first ? "Opened" : "Went to"} ${shortUrl(data.href)}`,
        detail: first ? `Screen ${data.width} × ${data.height}` : "",
      });
    } else if (event.type === INCREMENTAL && data.source === MUTATION) {
      for (const add of (data.adds as { parentId: number; node: SnapshotNode }[]) ?? []) {
        index.add(add.node, add.parentId);
      }
    } else if (
      event.type === INCREMENTAL &&
      data.source === MOUSE_INTERACTION &&
      data.type === CLICK
    ) {
      const name = index.describe(data.id as number | undefined);
      const rage = summary.clicks[clickNumber]?.rage ?? false;
      clickNumber += 1;

      if (rage && rageBurst && at - rageBurst.lastAt <= RAGE_GAP_MS) {
        // Another click in the same burst: update the existing moment instead of adding a new one.
        rageBurst.count += 1;
        rageBurst.lastAt = at;
        const seconds = ((rageBurst.lastAt - rageBurst.firstAt) / 1000).toFixed(1);
        rageBurst.moment.detail = `${rageBurst.count} clicks in ${seconds} s. The page didn't react.`;
      } else if (rage) {
        const moment: Moment = { at, kind: "rage", title: `Rage click on ${name}`, detail: "" };
        rageBurst = { moment, count: 1, firstAt: at, lastAt: at };
        moments.push(moment);
      } else {
        rageBurst = null;
        moments.push({ at, kind: "click", title: `Clicked ${name}`, detail: "" });
      }
    } else if (event.type === INCREMENTAL && data.source === INPUT) {
      if (typing && typing.target === data.id && at - typing.lastAt <= TYPING_GAP_MS) {
        typing.lastAt = at;
      } else {
        const moment: Moment = {
          at,
          kind: "type",
          title: `Typed in ${index.describe(data.id as number | undefined)}`,
          detail: "What they typed is hidden for privacy",
        };
        typing = { moment, target: data.id, lastAt: at };
        moments.push(moment);
      }
    }
  }

  const end = events[events.length - 1].timestamp - start;
  moments.push({
    at: end,
    kind: "end",
    title: "Recording ended",
    detail: "The visitor left or closed the tab",
  });
  return moments;
}
