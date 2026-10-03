// "Events per visit": the latest visits as a line (older on the left, newer on the right).
// Rage visits are orange dots, the dashed line is the average. Hover for details, click a dot
// to watch that visit. Drawn by hand with SVG: we work out each point's x/y, then draw.
import type { SessionSummary } from "@replay/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { browserName, formatDuration, formatTime } from "../format";

// The drawing area, in SVG units (it stretches to fit the card).
const W = 640;
const H = 270;
const LEFT = 44;
const RIGHT = 624;
const TOP = 14;
const BOTTOM = 228;

/** A round gridline step, so 4 steps cover the biggest value: 58 → 15 (0,15,30,45,60), 130 → 40. */
function niceStep(maxValue: number): number {
  const rough = maxValue / 4;
  const power = 10 ** Math.floor(Math.log10(rough)); // 1, 10, 100, …
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10].map((m) => m * power).find((s) => s >= rough);
  return Math.max(1, step ?? 10 * power);
}

/** A smooth curve through the points (each corner rounded using its neighbours).
 *  The bend points are kept inside the chart, so the curve never dips below 0. */
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [
      points[i - 1] ?? points[i],
      points[i],
      points[i + 1],
      points[i + 2] ?? points[i + 1],
    ];
    const keepInside = (yValue: number) => Math.min(BOTTOM, Math.max(TOP, yValue));
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, keepInside(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, keepInside(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function EventsChart({ visits }: { visits: SessionSummary[] }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<number | null>(null);

  const step = niceStep(Math.max(4, ...visits.map((v) => v.eventCount)));
  const max = step * 4;
  const x = (i: number) =>
    visits.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + ((RIGHT - LEFT) * i) / (visits.length - 1);
  const y = (value: number) => BOTTOM - ((BOTTOM - TOP) * value) / max;
  const points = visits.map((v, i) => [x(i), y(v.eventCount)] as [number, number]);
  const line = smoothPath(points);
  const average = visits.reduce((sum, v) => sum + v.eventCount, 0) / (visits.length || 1);
  const ticks = [0, 1, 2, 3, 4].map((n) => n * step);
  // Show at most ~8 labels on the x-axis so they don't overlap.
  const labelEvery = Math.max(1, Math.ceil(visits.length / 8));

  const hovered = hover === null ? null : visits[hover];

  return (
    <div className="min-w-0 rounded-card bg-panel p-[22px]">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-base font-medium text-ink">Events per visit</h3>
        <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-0.5 w-3.5 rounded bg-violet" />
            Events
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-[9px] w-[9px] rounded-full bg-accent" />
            Rage visit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-0.5 w-3.5 bg-[repeating-linear-gradient(90deg,var(--muted)_0_4px,transparent_4px_8px)]" />
            Average
          </span>
        </div>
      </div>

      {visits.length === 0 ? (
        <p className="py-16 text-center text-muted">No visits yet.</p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full overflow-visible"
            role="img"
            aria-label={`Events for the last ${visits.length} visits. Average ${Math.round(average)}.`}
          >
            <defs>
              <linearGradient id="events-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--violet)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line x1={LEFT} x2={RIGHT} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={LEFT - 12} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
                  {t}
                </text>
              </g>
            ))}
            {visits.map((v, i) =>
              // Every few points, plus the last one, but skip a label that would touch the last.
              (i % labelEvery === 0 && visits.length - 1 - i >= labelEvery) ||
              i === visits.length - 1 ? (
                <text
                  key={v.id}
                  x={x(i)}
                  y={BOTTOM + 24}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--muted)"
                >
                  {formatTime(v.startedAt)}
                </text>
              ) : null,
            )}

            <path
              d={`${line} L${points[points.length - 1][0]} ${BOTTOM} L${points[0][0]} ${BOTTOM} Z`}
              fill="url(#events-fill)"
            />
            <line
              x1={LEFT}
              x2={RIGHT}
              y1={y(average)}
              y2={y(average)}
              stroke="var(--muted)"
              strokeWidth="1.5"
              strokeDasharray="4 5"
            />
            <text x={RIGHT} y={y(average) - 8} textAnchor="end" fontSize="12" fill="var(--muted)">
              avg {Math.round(average)}
            </text>
            <path d={line} fill="none" stroke="var(--violet)" strokeWidth="2.5" />

            {hover !== null && (
              <line
                x1={points[hover][0]}
                x2={points[hover][0]}
                y1={TOP}
                y2={BOTTOM}
                stroke="var(--muted)"
                strokeDasharray="3 4"
              />
            )}
            {visits.map((v, i) => (
              <circle
                key={v.id}
                cx={points[i][0]}
                cy={points[i][1]}
                r={v.hasRage ? 5 : 4}
                fill={v.hasRage ? "var(--accent)" : "var(--panel)"}
                stroke={v.hasRage ? "var(--accent)" : "var(--violet)"}
                strokeWidth="2"
              />
            ))}
            {hover !== null && (
              <circle
                cx={points[hover][0]}
                cy={points[hover][1]}
                r="9"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
            )}

            {/* Invisible strips, one per visit: hovering anywhere in a strip selects that visit. */}
            {visits.map((v, i) => {
              const half =
                visits.length === 1 ? (RIGHT - LEFT) / 2 : (RIGHT - LEFT) / (visits.length - 1) / 2;
              return (
                <rect
                  key={v.id}
                  x={points[i][0] - half}
                  y={TOP}
                  width={half * 2}
                  height={BOTTOM - TOP}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => navigate(`/sessions/${v.id}`)}
                >
                  <title>Watch this visit</title>
                </rect>
              );
            })}
          </svg>

          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute min-w-[190px] rounded-[14px] border border-line bg-panel-2 px-3.5 py-3 text-xs text-text"
              style={{
                left: `calc(${(points[hover][0] / W) * 100}% ${points[hover][0] > W * 0.65 ? "- 204px" : "+ 14px"})`,
                top: `max(0px, calc(${(points[hover][1] / H) * 100}% - 40px))`,
              }}
            >
              <b className="mb-1.5 block text-[13px] font-semibold text-ink">
                {formatTime(hovered.startedAt)} · {browserName(hovered.userAgent)}
              </b>
              {[
                ["Events", String(hovered.eventCount)],
                ["Clicks", String(hovered.clickCount)],
                ["Length", formatDuration(hovered.durationMs)],
                ["Outcome", hovered.hasRage ? `Rage ×${hovered.rageClickCount}` : "No problems"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span>{label}</span>
                  <strong
                    className={`font-semibold tabular-nums ${label === "Outcome" && hovered.hasRage ? "text-accent" : "text-ink"}`}
                  >
                    {value}
                  </strong>
                </div>
              ))}
              <span className="mt-1.5 block text-muted">Click to watch</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
