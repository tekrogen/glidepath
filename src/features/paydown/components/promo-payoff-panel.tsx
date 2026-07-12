/**
 * 0% promo payoff plan. Layout per the mockup (Overview placement);
 * styling per Ebia's promo-payoff-panel, including the 30/60-day urgency
 * badge tiers. Plans precomputed by lib/finance; the missing-minimum
 * nudge never guesses (EDR-020).
 */
import { CalendarClock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EstimatedValue } from "@/components/ui/estimated-value"
import { formatAprBps, formatMinor, formatShortDate } from "@/lib/formatting"
import type { PromoPayoffPlan } from "@/lib/finance"
import type { PortfolioCard } from "@/features/cards/server/service"

function DaysLeftBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 30) {
    return (
      <Badge variant="outline" className="border-destructive/50 text-destructive">
        {daysLeft}d left
      </Badge>
    )
  }
  if (daysLeft <= 60) {
    return (
      <Badge
        variant="outline"
        className="border-warning/50 bg-warning/10 text-warning"
      >
        {daysLeft}d left
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {daysLeft}d left
    </Badge>
  )
}

export function PromoPayoffPanel({
  plans,
  cards,
}: {
  plans: PromoPayoffPlan[]
  cards: PortfolioCard[]
}) {
  if (plans.length === 0) return null
  const byId = new Map(cards.map((c) => [c.id, c]))
  const offTrack = plans.filter((p) => p.onTrack === false).length
  const planTotal = plans.reduce((s, p) => s + p.requiredMonthlyMinor, 0n)
  const knownMinimums = plans.filter((p) => p.currentMonthlyMinor != null)
  const recordedMinimums = knownMinimums.reduce((s, p) => s + (p.currentMonthlyMinor ?? 0n), 0n)
  const missingMinimums = plans.length - knownMinimums.length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">0% Promo Payoff Plan</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          What each promo balance needs per month to reach $0 before its regular APR kicks in
          {offTrack > 0 &&
            ` — ${offTrack} ${offTrack === 1 ? "card is" : "cards are"} not on track at the current minimum`}
          .
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {plans.map((p) => {
            const card = byId.get(p.cardId)
            const promo = card?.finance.promo
            return (
              <li key={p.cardId} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{card?.cardName ?? p.cardId}</span>
                    <DaysLeftBadge daysLeft={p.daysLeft} />
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatMinor(card?.finance.balanceMinor ?? 0n)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pay{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMinor(p.requiredMonthlyMinor)}/mo
                  </span>{" "}
                  ({p.paymentsLeft} payment{p.paymentsLeft === 1 ? "" : "s"}) to clear it
                  {promo && ` before ${formatShortDate(promo.endsOn)}`}.
                </p>
                {p.onTrack === false && p.projectedRemainingMinor != null && (
                  <p className="mt-0.5 text-sm text-destructive">
                    At {formatMinor(p.currentMonthlyMinor!)}/mo min,{" "}
                    <EstimatedValue>{formatMinor(p.projectedRemainingMinor)}</EstimatedValue>{" "}
                    remains
                    {p.postPromoMonthlyInterestMinor != null && promo?.regularAprBpsAfter != null && (
                      <>
                        {" "}
                        — <EstimatedValue>{formatMinor(p.postPromoMonthlyInterestMinor)}</EstimatedValue>
                        /mo interest at {formatAprBps(promo.regularAprBpsAfter)}
                      </>
                    )}
                    .
                  </p>
                )}
                {p.onTrack === null && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Add this card&apos;s minimum payment to see whether you&apos;re on track.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-muted/50 px-3 py-2.5">
          <span className="text-sm font-medium">Minimum Payoff Plan total</span>
          <span className="text-right">
            <span className="font-semibold tabular-nums">{formatMinor(planTotal)}/mo</span>
            <span className="block text-xs text-muted-foreground">
              vs {formatMinor(recordedMinimums)}/mo in recorded minimums
              {missingMinimums > 0 &&
                ` · ${missingMinimums} ${missingMinimums === 1 ? "card is" : "cards are"} missing a minimum`}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
