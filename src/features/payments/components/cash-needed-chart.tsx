"use client"

/**
 * Cash-needed-per-week bars (issue #44, wireframe 1c bottom triad).
 * Hand-rolled like the overview widgets — seven bars don't need a chart
 * library. Figures arrive precomputed from runwayAggregate; the footer
 * discloses the cash-needed rule so the number is auditable (the rule
 * lives in lib/finance, EDR-019).
 */
import { BarChart3 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Minor, RunwayWeekBucket } from "@/lib/finance"
import { formatMinor, formatMonthDay } from "@/lib/formatting"

export function CashNeededChart({
  weeks,
  totalMinor,
}: {
  weeks: RunwayWeekBucket[]
  totalMinor: Minor
}) {
  const max = weeks.reduce((m, w) => (w.cashNeededMinor > m ? w.cashNeededMinor : m), 0n)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Cash needed / week</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex h-24 items-end gap-2" aria-hidden>
          {weeks.map((w) => {
            const pct = max === 0n ? 0 : Number((w.cashNeededMinor * 100n) / max)
            return (
              <div key={w.index} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className={`w-full rounded-t ${w.index === 0 ? "bg-chart-1" : "bg-chart-2"}`}
                  style={{ height: `${Math.max(pct, w.cashNeededMinor > 0n ? 4 : 0)}%` }}
                  title={`Week of ${formatMonthDay(w.startsOn)}: ${formatMinor(w.cashNeededMinor)}`}
                  data-testid="cash-week-bar"
                />
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-2" aria-hidden>
          {weeks.map((w) => (
            <span
              key={w.index}
              className="flex-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground tabular-nums"
            >
              {w.index === 0 ? "Now" : formatMonthDay(w.startsOn)}
            </span>
          ))}
        </div>
        <ul className="sr-only">
          {weeks.map((w) => (
            <li key={w.index}>
              Week of {formatMonthDay(w.startsOn)}: {formatMinor(w.cashNeededMinor)}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="tabular-nums font-medium text-foreground">{formatMinor(totalMinor)}</span>{" "}
          total — scheduled payments plus remaining minimums; cards without a recorded minimum
          contribute nothing.
        </p>
      </CardContent>
    </Card>
  )
}
