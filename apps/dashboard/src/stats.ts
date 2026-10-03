// All the maths for the Overview page, in one pure function: visits in, numbers out.
// No React and no drawing here, which makes it easy to test.
import type { SessionSummary } from "@replay/shared";
import { isReplayable } from "./useSessions";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** The heatmap's rows: the day split into 4-hour blocks. */
export const TIME_BLOCKS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];

export type Stats = {
  visits: number; // visits with something to watch
  emptyVisits: number; // visitor left before anything was recorded
  rageVisits: number;
  calmVisits: number;
  ragePercent: number; // 0–100, rounded
  calmPercent: number;
  visitsToday: number;
  events: number;
  avgEvents: number; // per visit, rounded
  rageClicks: number;
  avgDurationMs: number;
  longestDurationMs: number;
  /** heatmap[timeBlock][day] = number of visits started then, in the viewer's time zone. */
  heatmap: number[][];
  /** The latest visits, oldest first, for the "Events per visit" chart. */
  recent: SessionSummary[];
};

export function computeStats(all: SessionSummary[], now = new Date(), chartSize = 20): Stats {
  const sessions = all.filter(isReplayable);
  const visits = sessions.length;
  const rageVisits = sessions.filter((s) => s.hasRage).length;
  const events = sessions.reduce((sum, s) => sum + s.eventCount, 0);
  const durations = sessions.map((s) => s.durationMs);
  const percent = (part: number) => (visits === 0 ? 0 : Math.round((part / visits) * 100));

  const heatmap = TIME_BLOCKS.map(() => DAYS.map(() => 0));
  for (const s of sessions) {
    const started = new Date(s.startedAt); // shown in the viewer's own time zone
    const day = (started.getDay() + 6) % 7; // getDay(): Sunday = 0. We want Monday = 0.
    heatmap[Math.floor(started.getHours() / 4)][day] += 1;
  }

  const sameDay = (iso: string) => new Date(iso).toDateString() === now.toDateString();

  return {
    visits,
    emptyVisits: all.length - visits,
    rageVisits,
    calmVisits: visits - rageVisits,
    ragePercent: percent(rageVisits),
    calmPercent: percent(visits - rageVisits),
    visitsToday: sessions.filter((s) => sameDay(s.startedAt)).length,
    events,
    avgEvents: visits === 0 ? 0 : Math.round(events / visits),
    rageClicks: sessions.reduce((sum, s) => sum + s.rageClickCount, 0),
    avgDurationMs: visits === 0 ? 0 : Math.round(durations.reduce((a, b) => a + b, 0) / visits),
    longestDurationMs: Math.max(0, ...durations),
    heatmap,
    // The API sends newest first; the chart reads left (older) to right (newer).
    recent: sessions.slice(0, chartSize).reverse(),
  };
}
