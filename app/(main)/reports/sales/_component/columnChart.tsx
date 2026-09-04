"use client";

import { useEffect, useRef, useState } from "react";
import { useGrowOnChange, useReducedMotion } from "./motion";

export interface ColumnDatum {
  /** x position key — also the tooltip's heading. */
  label: string;
  value: number;
}

interface Props {
  title: string;
  unit: string;
  data: ColumnDatum[];
  color: string;
  /** How a value is written in the tooltip and on the labelled peak. */
  format: (n: number) => string;
  height?: number;
}

// Chart chrome. One step off the surface, hairline, solid — the grid is there to
// be read past, not looked at.
const GRID = "#00000014";
const AXIS_TEXT = "#00000073";
const SURFACE = "#f2f1ee";

const PAD = { top: 18, right: 8, bottom: 26, left: 56 };
// Bars are capped rather than filling their band: the leftover is the air that
// keeps a 30-day month from reading as a solid block.
const MAX_BAR = 24;
const BAR_GAP = 2;

// "Nice" axis maximum — 1/2/5 × 10^k — so the ticks land on numbers a person
// would actually say out loud.
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= step * base) return step * base;
  }
  return 10 * base;
}

function barPath(x: number, y: number, w: number, h: number): string {
  // 4px rounded data-end, square at the baseline — the bar grows out of the axis,
  // so rounding the foot would lift it off its own zero line.
  const r = Math.max(0, Math.min(4, w / 2, h));
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

// A single-series column chart drawn as plain SVG — no chart library, and none
// needed for one measure over time. Every value it shows is also in the table
// below it, so the hover layer enhances and never gates.
export function ColumnChart({ title, unit, data, color, format, height = 200 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const reduced = useReducedMotion();

  // Bars grow out of the baseline when the shape of the chart changes — a new
  // metal, a new date range, day↔month. Deliberately NOT on every value change:
  // re-growing the whole chart on each keystroke in the search box would be a
  // twitch, not a signal.
  const grown = useGrowOnChange(`${color}|${data.length}`);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const plotH = Math.max(40, height - PAD.top - PAD.bottom);

  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const top = niceMax(max);
  const band = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.max(1, Math.min(MAX_BAR, band - BAR_GAP));
  const yOf = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  // Label only the peak. A number on every column is chaos; the axis, the
  // tooltip and the table carry the rest.
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  // Thin out x labels until they stop colliding — roughly 62px of room each.
  // The last tick is always worth having (it names the end of the range), so it
  // is placed first and the regular ticks are dropped where they would crowd it;
  // thinning alone leaves the final pair overlapping on a narrow card.
  const MIN_LABEL_GAP = 62;
  const xOfBand = (i: number) => PAD.left + i * band + band / 2;
  const labelEvery = Math.max(1, Math.ceil((data.length * MIN_LABEL_GAP) / plotW));
  const lastIndex = data.length - 1;
  const labelled = new Set<number>([lastIndex]);
  for (let i = 0; i < lastIndex; i += labelEvery) {
    if (xOfBand(lastIndex) - xOfBand(i) >= MIN_LABEL_GAP) labelled.add(i);
  }

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="flex flex-col gap-y-1 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3">
      <div className="flex items-baseline justify-between gap-x-2">
        <span className="text-sm font-bold text-black/70">{title}</span>
        <span className="text-[10px] text-black/40">{unit}</span>
      </div>

      <div ref={wrapRef} className="relative w-full">
        {/* Zero-filled buckets with nothing in them are still "no data" — plotting
            them draws an axis of 0.3 / 0.5 / 0.8 under a flat line, which reads as
            broken rather than empty. */}
        {data.length === 0 || max <= 0 ? (
          <div
            className="flex items-center justify-center text-xs text-black/35"
            style={{ height }}
          >
            ไม่มีข้อมูลในช่วงที่เลือก
          </div>
        ) : data.length === 1 ? (
          // A single bucket (ช่วง "วันนี้") is one number, and a one-bar bar chart
          // is a stat tile wearing a plot. Show the figure.
          <div
            className="flex flex-col items-center justify-center gap-y-1"
            style={{ height }}
          >
            <span className="text-3xl font-bold text-black/80">
              {format(data[0].value)}
            </span>
            <span className="text-xs text-black/40">
              {data[0].label} · {unit}
            </span>
          </div>
        ) : (
          <>
            <svg width={width} height={height} role="img" aria-label={`${title} (${unit})`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + plotW}
                    y1={yOf(t)}
                    y2={yOf(t)}
                    stroke={GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 6}
                    y={yOf(t) + 3}
                    textAnchor="end"
                    fontSize={9}
                    fill={AXIS_TEXT}
                  >
                    {t.toLocaleString(undefined, { maximumFractionDigits: t < 10 ? 1 : 0 })}
                  </text>
                </g>
              ))}

              {data.map((d, i) => {
                const x = PAD.left + i * band + (band - barW) / 2;
                const y = yOf(d.value);
                const h = PAD.top + plotH - y;
                return (
                  <g key={d.label}>
                    <path
                      d={barPath(x, y, barW, h)}
                      fill={color}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                      style={{
                        transformOrigin: `0px ${PAD.top + plotH}px`,
                        transform: reduced || grown ? "scaleY(1)" : "scaleY(0)",
                        // Expo-out: most of the height is covered in the first
                        // third of the time, so the bar reads as launching rather
                        // than sliding. Deliberately no overshoot — a bar that
                        // briefly stands above its own value is the same lie the
                        // count-up used to tell, just drawn instead of written.
                        //
                        // The reset to zero MUST be untransitioned. Leaving the
                        // transition on made the browser animate the way DOWN too,
                        // and since the flip back up lands a frame later it simply
                        // reversed an animation that had barely started — the bars
                        // never visibly moved at all.
                        transition: reduced
                          ? "opacity 150ms linear"
                          : grown
                            ? `transform 420ms cubic-bezier(.16,1,.3,1) ${Math.min(i * 22, 380)}ms, opacity 150ms linear`
                            : "none",
                      }}
                    />
                    {/* The hit target is the whole band, not the painted pixels —
                        a 3px column on a quiet day is otherwise unhoverable. */}
                    <rect
                      x={PAD.left + i * band}
                      y={PAD.top}
                      width={band}
                      height={plotH}
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-label={`${d.label}: ${format(d.value)} ${unit}`}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className="outline-none focus-visible:stroke-black/30"
                    />
                  </g>
                );
              })}

              {/* Direct label on the peak only — anchored away from the edge when
                  the peak sits at either end, so the text is never cut off. */}
              {max > 0 &&
                (() => {
                  const center = PAD.left + peak * band + band / 2;
                  const nearLeft = center < PAD.left + 28;
                  const nearRight = center > PAD.left + plotW - 28;
                  return (
                    <text
                      x={nearLeft ? PAD.left : nearRight ? PAD.left + plotW : center}
                      y={yOf(data[peak].value) - 5}
                      textAnchor={nearLeft ? "start" : nearRight ? "end" : "middle"}
                      fontSize={9}
                      fontWeight={700}
                      fill={AXIS_TEXT}
                      style={{
                        opacity: reduced || grown ? 1 : 0,
                        transition: reduced
                          ? undefined
                          : `opacity 260ms ease-out ${Math.min(peak * 22, 380) + 300}ms`,
                      }}
                    >
                      {format(data[peak].value)}
                    </text>
                  );
                })()}

              {data.map((d, i) =>
                labelled.has(i) ? (
                  <text
                    key={`x-${d.label}`}
                    x={xOfBand(i)}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize={9}
                    fill={AXIS_TEXT}
                  >
                    {d.label}
                  </text>
                ) : null,
              )}
            </svg>

            {active && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 rounded-xl border-1 border-black/10 px-2 py-1.5 shadow-lg"
                style={{
                  background: SURFACE,
                  left: Math.min(
                    Math.max(PAD.left + (hover ?? 0) * band + band / 2, 60),
                    width - 60,
                  ),
                  top: 4,
                }}
              >
                {/* Value leads, label follows — the reader already knows the day. */}
                <div className="flex items-center gap-x-1.5">
                  <span
                    className="inline-block h-0.5 w-3 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-xs font-bold text-black/80">
                    {format(active.value)}
                  </span>
                </div>
                <div className="text-[10px] text-black/50">{active.label}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
