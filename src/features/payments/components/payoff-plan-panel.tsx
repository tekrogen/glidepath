"use client"

/**
 * Payoff plan panel (issue #44, wireframe 1c bottom triad): the
 * avalanche/snowball debt-free readout. The budget is user input (the
 * what-if precedent); the projection is debtFreePlan — client-side
 * calls into lib/finance, no math here (EDR-019). Payoff dates are
 * projections under stated assumptions, disclosed in the footer.
 */
import { useMemo, useState } from "react"
import { Route } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  debtFreePlan,
  parseDollarsToMinor,
  portfolioSummary,
  type DebtStrategy,
} from "@/lib/finance"
import { formatMinor, formatShortDate, toDollarInput } from "@/lib/formatting"

import type { LaneCard } from "./runway-view"

const STEP_LIMIT = 4

export function PayoffPlanPanel({ cards, asOf }: { cards: LaneCard[]; asOf: Date }) {
  const [strategy, setStrategy] = useState<DebtStrategy>("avalanche")
  // Default budget = the portfolio's recorded minimums — the figure
  // lib/finance already owns (EDR-019: no re-derived sums in components).
  const defaultBudget = useMemo(() => {
    const minimums = portfolioSummary(cards, asOf).totalMinimumPaymentsMinor
    return minimums > 0n ? toDollarInput(minimums) : ""
  }, [cards, asOf])
  const [budget, setBudget] = useState(defaultBudget)

  const budgetMinor = parseDollarsToMinor(budget)
  const plan = useMemo(
    () => (budgetMinor == null ? null : debtFreePlan(cards, strategy, budgetMinor, asOf)),
    [cards, strategy, budgetMinor, asOf]
  )
  const nameById = useMemo(() => new Map(cards.map((c) => [c.id, c.cardName])), [cards])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Payoff plan</CardTitle>
          </div>
          <div
            className="inline-flex rounded-md border border-border p-0.5"
            role="group"
            aria-label="Payoff strategy"
          >
            <StrategyChip
              active={strategy === "avalanche"}
              onClick={() => setStrategy("avalanche")}
              testid="payoff-strategy-avalanche"
            >
              Avalanche
            </StrategyChip>
            <StrategyChip
              active={strategy === "snowball"}
              onClick={() => setStrategy("snowball")}
              testid="payoff-strategy-snowball"
            >
              Snowball
            </StrategyChip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 font-medium uppercase tracking-[0.12em]">Budget</span>
          <span className="relative flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-8 pl-6 text-sm tabular-nums"
              aria-label="Monthly payoff budget in dollars"
              data-testid="payoff-budget"
            />
          </span>
          <span className="shrink-0">/ mo</span>
        </label>

        {plan == null ? (
          <p className="py-2 text-sm text-muted-foreground">
            Enter a monthly budget to project a debt-free date.
          </p>
        ) : plan.months === 0 ? (
          <p className="py-2 text-sm" data-testid="payoff-readout">
            Already debt-free — no carried balances.
          </p>
        ) : (
          <>
            <p className="text-sm" data-testid="payoff-readout">
              <span className="font-medium">Debt-free {formatShortDate(plan.debtFreeDate)}</span>{" "}
              <span className="text-muted-foreground tabular-nums">
                · {plan.months} {plan.months === 1 ? "month" : "months"} at {formatMinor(budgetMinor!)}/mo
              </span>
            </p>
            <ol className="space-y-1.5">
              {plan.steps.slice(0, STEP_LIMIT).map((step, i) => (
                <li key={step.cardId} className="flex items-center gap-2 text-xs">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border font-mono text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{nameById.get(step.cardId) ?? step.cardId}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatShortDate(step.payoffDate)}
                  </span>
                </li>
              ))}
            </ol>
            {plan.steps.length > STEP_LIMIT && (
              <p className="text-xs text-muted-foreground">
                + {plan.steps.length - STEP_LIMIT} more cards in sequence
              </p>
            )}
          </>
        )}

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Assumes fixed APRs and no new purchases — the same basis as What-if.
        </p>
      </CardContent>
    </Card>
  )
}

function StrategyChip({
  active,
  onClick,
  testid,
  children,
}: {
  active: boolean
  onClick: () => void
  testid: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testid}
      className={`rounded px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
