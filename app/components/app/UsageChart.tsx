"use client";

import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface UsagePoint {
  date: string;
  generations: number;
  words: number;
}

const BAR_COLOR = "#8b5cf6"; // validated against the card surface (dark)
const BAR_HOVER = "#a78bfa";

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Single-series column chart: completed AI generations per day (UTC). */
export default function UsageChart({ data }: { data: UsagePoint[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.generations)));
  const peakIndex = data.reduce((best, d, i) => (d.generations > (data[best]?.generations ?? 0) ? i : best), 0);
  const total = data.reduce((sum, d) => sum + d.generations, 0);
  const ticks = [max, max / 2, 0];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Generations · last 14 days</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(total)} completed in this period</p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Chart view">
          {(["chart", "table"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition",
                view === mode ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "chart" ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
              {mode === "chart" ? "Chart" : "Table"}
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <div className="max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Generations</th>
                <th className="px-3 py-2 text-right font-medium">Words</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="px-3 py-1.5">{dayLabel(d.date)}</td>
                  <td className="px-3 py-1.5 text-right">{formatNumber(d.generations)}</td>
                  <td className="px-3 py-1.5 text-right">{formatNumber(d.words)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative flex h-52 gap-2">
          <div className="flex w-6 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
                {formatNumber(Math.round(t))}
              </span>
            ))}
          </div>
          <div className="relative flex-1">
            {/* Hairline gridlines */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden>
              {ticks.map((t) => (
                <div key={t} className="h-px bg-border" />
              ))}
            </div>
            <ul className="absolute inset-x-0 top-0 bottom-6 flex items-end" aria-label="Generations per day">
              {data.map((d, i) => {
                const height = max > 0 ? (d.generations / max) * 100 : 0;
                const isActive = active === i;
                return (
                  <li key={d.date} className="relative flex h-full flex-1 items-end justify-center">
                    <button
                      type="button"
                      className="absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      aria-label={`${dayLabel(d.date)}: ${d.generations} generation${d.generations === 1 ? "" : "s"}, ${d.words} words`}
                    />
                    {i === peakIndex && d.generations > 0 && (
                      <span
                        className="pointer-events-none absolute text-[11px] font-medium tabular-nums text-foreground"
                        style={{ bottom: `calc(${height}% + 4px)` }}
                        aria-hidden
                      >
                        {d.generations}
                      </span>
                    )}
                    <span
                      className="pointer-events-none w-full max-w-6 rounded-t-[4px] transition-colors"
                      style={{
                        height: d.generations > 0 ? `max(${height}%, 3px)` : "0px",
                        backgroundColor: isActive ? BAR_HOVER : BAR_COLOR,
                        marginInline: "1px",
                      }}
                      aria-hidden
                    />
                    {isActive && (
                      <div
                        role="tooltip"
                        className={cn(
                          "pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl",
                          i < 3 && "left-0",
                          i > data.length - 4 && "right-0",
                        )}
                      >
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {formatNumber(d.generations)} generation{d.generations === 1 ? "" : "s"}
                        </p>
                        <p className="text-muted-foreground">
                          {dayLabel(d.date)} · {formatNumber(d.words)} words
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="absolute inset-x-0 bottom-0 flex h-5 items-end justify-between text-[11px] text-muted-foreground" aria-hidden>
              <span>{dayLabel(data[0]?.date ?? "")}</span>
              <span>{dayLabel(data[Math.floor(data.length / 2)]?.date ?? "")}</span>
              <span>{dayLabel(data[data.length - 1]?.date ?? "")}</span>
            </div>
            {total === 0 && (
              <p className="absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">No generations yet in this period.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
