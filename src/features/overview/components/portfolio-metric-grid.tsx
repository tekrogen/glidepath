/**
 * Overview metric tiles. Layout per the mockup; styling per Ebia's
 * credit-cards-summary (the visual system of record — EDR-013 corrected).
 * Pure presentation: every figure arrives precomputed from lib/finance.
 *
 * The hero OverviewHeader now owns total balance + overall utilization, so
 * this grid carries only the complementary figures (available credit / 0%
 * sheltered, minimum payments / est. interest) — no duplication (design QA).
 */
import { CalendarClock, Wallet } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EstimatedValue } from "@/components/ui/estimated-value"
import { formatMinor, formatShortDate } from "@/lib/formatting"
import type { PortfolioSummary } from "@/lib/finance"

import {
  availableCreditDisplay,
  hasEstimatedInterest,
  shelteredSubtitle,
} from "../utils/metric-format"

export function PortfolioMetricGrid({ summary }: { summary: PortfolioSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Available Credit
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {availableCreditDisplay(summary)}
          </div>
          <p className="text-xs text-muted-foreground">{shelteredSubtitle(summary)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Min. Payments Due / Month
          </CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatMinor(summary.totalMinimumPaymentsMinor)}
          </div>
          <p className="text-xs text-muted-foreground">
            {hasEstimatedInterest(summary) ? (
              <>
                + <EstimatedValue>{formatMinor(summary.estMonthlyInterestMinor)}</EstimatedValue>
                /mo est. interest
                {summary.nextPromoExpiration &&
                  ` · next 0% ends ${formatShortDate(summary.nextPromoExpiration)}`}
              </>
            ) : summary.nextPromoExpiration ? (
              `Next 0% ends ${formatShortDate(summary.nextPromoExpiration)}`
            ) : (
              "No interest accruing this cycle"
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
