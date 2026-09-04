"use client";

import { grams, money, type SalesBreakdown } from "./types";
import { riseIn, useGrowOnChange, useReducedMotion } from "./motion";

interface Props {
  title: string;
  rows: SalesBreakdown[];
  color: string;
  /** Word for the row's identity column, used by the accessible summary. */
  unitLabel: string;
}

// A ranked breakdown: horizontal bar for the shape, the numbers right beside it
// for the value. The bar is the picture and the row is the table view — the same
// component satisfies both, so no value here is reachable only by hovering.
export function BreakdownBars({ title, rows, color, unitLabel }: Props) {
  const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);
  const reduced = useReducedMotion();

  // Bars sweep out to their share when the ranking changes shape.
  const grown = useGrowOnChange(rows.map((r) => r.key || r.label).join("|"));

  return (
    <div className="flex flex-col gap-y-2 border-1 border-black/10 bg-black/5 backdrop-blur-xl rounded-2xl p-3">
      <span className="text-sm font-bold text-black/70">{title}</span>
      {rows.length === 0 ? (
        <span className="py-6 text-center text-xs text-black/35">
          ไม่มีข้อมูลในช่วงที่เลือก
        </span>
      ) : (
        <div className="flex flex-col gap-y-2">
          {rows.map((row, i) => (
            <div
              key={row.key || row.label}
              className={`flex flex-col gap-y-1 ${reduced ? "" : "rp-rise"}`}
              style={reduced ? undefined : riseIn(i, 45, 270)}
            >
              <div className="flex items-baseline justify-between gap-x-2">
                <span className="min-w-0 truncate text-xs font-bold text-black/70">
                  {row.label}
                </span>
                <span className="shrink-0 text-xs font-bold text-black/80">
                  {money(row.amount)}
                </span>
              </div>
              <div className="flex items-center gap-x-2">
                {/* One row means one full-width bar, which encodes nothing — the
                    number beside it already is the whole story. The bar earns its
                    place only once there is something to compare against. */}
                {rows.length > 1 && (
                  <div className="h-2 flex-1 rounded-full bg-black/5">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        background: color,
                        width:
                          (reduced || grown) && max > 0
                            ? `${Math.max(2, (row.amount / max) * 100)}%`
                            : "0%",
                        // Same rule as the column chart: collapsing back to zero
                        // is instant, only the sweep out is animated.
                        transition:
                          reduced || !grown
                            ? "none"
                            : `width 440ms cubic-bezier(.16,1,.3,1) ${Math.min(i * 50, 300)}ms`,
                      }}
                    />
                  </div>
                )}
                <span
                  className={`shrink-0 text-[10px] text-black/40 ${rows.length > 1 ? "" : "ml-auto"}`}
                >
                  {grams(row.weight)} ก. · {row.docs} ใบ
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">
        {title} — {rows.length} {unitLabel}
      </span>
    </div>
  );
}
