/**
 * Overview metric tiles. Layout per the mockup; styling per Ebia's
 * credit-cards-summary (the visual system of record — EDR-013 corrected).
 * Pure presentation: every figure arrives precomputed from lib/finance.
 */
import { CalendarClock, CreditCard, Percent, Wallet } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EstimatedValue } from "@/components/ui/estimated-value"
import { formatMinor, formatPercent, formatShortDate } from "@/lib/formatting"
import type { PortfolioSummary } from "@/lib/finance"

export function PortfolioMetricGrid({ summary }: { summary: PortfolioSummary }) {
  const utilization = summary.overallUtilization ?? 0
  const utilizationHigh = utilization >= 0.3

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Balance
          </CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatMinor(summary.totalBalanceMinor)}
          </div>
          <p className="text-xs text-muted-foreground">
            of {formatMinor(summary.totalLimitMinor)} total limit across {summary.cardCount} cards
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Available Credit
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatMinor(summary.availableCreditMinor)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMinor(summary.shelteredMinor)} of balance sheltered at 0% APR across{" "}
            {summary.shelteredCardCount} cards
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Overall Utilization
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold tabular-nums ${utilizationHigh ? "text-destructive" : ""}`}
          >
            {summary.overallUtilization != null ? formatPercent(summary.overallUtilization) : "—"}
          </div>
          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${utilizationHigh ? "bg-destructive" : "bg-success"}`}
              style={{ width: `${Math.min(utilization * 100, 100)}%` }}
            />
            {/* 30% high-utilization threshold tick */}
            <div className="absolute inset-y-0 left-[30%] w-px bg-foreground/40" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Keeping under 30% is generally good for credit scores
          </p>
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
            + <EstimatedValue>{formatMinor(summary.estMonthlyInterestMinor)}</EstimatedValue>
            /mo est. interest
            {summary.nextPromoExpiration &&
              ` · next 0% ends ${formatShortDate(summary.nextPromoExpiration)}`}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
