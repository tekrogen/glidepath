"use client"

/**
 * "What if I pay extra…" — layout per the mockup (inside Paydown Priority);
 * styled to the Ebia idiom. Recomputes live through lib/finance's
 * whatIfExtraPayment (pure, runs client-side; cents cross the boundary as
 * numbers — EDR-019 intact). Assumptions per EDR-020; results are estimates.
 */
import { useMemo, useState } from "react"

import { whatIfExtraPayment, type FinanceCard } from "@/lib/finance"
import { formatAprBps, formatMinor, formatShortDate } from "@/lib/formatting"

export interface WhatIfCardDto {
  id: string
  cardName: string
  balanceCents: number
  limitCents: number | null
  regularAprBps: number | null
}

export function WhatIfSlider({ cards }: { cards: WhatIfCardDto[] }) {
  const [extraDollars, setExtraDollars] = useState(500)

  const step = useMemo(() => {
    const finance: FinanceCard[] = cards.map((c) => ({
      id: c.id,
      balanceMinor: BigInt(c.balanceCents),
      limitMinor: c.limitCents == null ? null : BigInt(c.limitCents),
      regularAprBps: c.regularAprBps,
      minimumPaymentMinor: null,
      promo: null,
    }))
    const steps = whatIfExtraPayment(finance, BigInt(extraDollars * 100), new Date())
    return steps[0] ?? null
  }, [cards, extraDollars])

  const first = step ? cards.find((c) => c.id === step.cardId) : null

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted-foreground">What if I pay extra…</span>
        <span className="text-sm font-semibold tabular-nums text-primary">
          ${extraDollars.toLocaleString()}/mo
        </span>
      </div>
      <input
        type="range"
        min={50}
        max={2000}
        step={50}
        value={extraDollars}
        onChange={(e) => setExtraDollars(Number(e.target.value))}
        className="mt-3 w-full accent-[hsl(var(--primary))]"
        aria-label="Extra monthly payment amount"
      />
      <p className="mt-2 text-xs text-muted-foreground" data-testid="whatif-result">
        {step && first ? (
          <>
            {first.cardName} drops under 30% by {formatShortDate(step.crossDate)} (
            {step.monthsToCross} payments)
            {step.monthlySavingsMinor != null && first.regularAprBps != null && (
              <>
                {" "}
                — saves ~{formatMinor(step.monthlySavingsMinor)}/mo interest at{" "}
                {formatAprBps(first.regularAprBps)}
              </>
            )}
            .
          </>
        ) : (
          <>All cards are already under 30% utilization.</>
        )}
      </p>
    </div>
  )
}
