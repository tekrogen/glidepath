import { estMonthlyInterestMinor } from "./interest"
import type { Minor } from "./money"
import { ceilDiv } from "./money"
import { paydownRank } from "./paydown"
import type { FinanceCard } from "./types"

export interface WhatIfStep {
  cardId: string
  /** Extra dollars needed to bring this card below the 30% threshold. */
  paydownNeededMinor: Minor
  /** Months of extra payments until this card crosses below 30% (cascade-cumulative). */
  monthsToCross: number
  /** Calendar date of the crossing (today + monthsToCross months). */
  crossDate: Date
  /** Monthly interest that stops accruing once crossed (estimate — render with "~"). */
  monthlySavingsMinor: Minor | null
}

/**
 * "What if I pay extra…" projection (Blueprint Level 2).
 *
 * Assumptions (EDR-020, disclosed in UI): fixed APRs, no new purchases,
 * other cards' minimums maintained, no intra-projection compounding.
 * The extra amount allocates to the top paydown-priority card until it
 * crosses below 30% utilization, then cascades to the next.
 *
 * Conformance anchor (Hi-Fi Overview): $500/mo extra on an $8,097.69
 * balance with a $10,000 limit at 22.74% APR → crosses in 11 payments,
 * saving ~$96.60/mo.
 */
export function whatIfExtraPayment(
  cards: FinanceCard[],
  extraMonthlyMinor: Minor,
  today: Date
): WhatIfStep[] {
  if (extraMonthlyMinor <= 0n) return []

  const rank = paydownRank(cards, today)
  const ordered = [...rank.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => cards.find((c) => c.id === id)!)

  const steps: WhatIfStep[] = []
  let cumulativeNeeded = 0n
  for (const card of ordered) {
    if (card.limitMinor == null || card.limitMinor <= 0n) continue
    const thresholdMinor = (card.limitMinor * 3n) / 10n
    const needed = card.balanceMinor - thresholdMinor
    if (needed <= 0n) continue
    cumulativeNeeded += needed
    const monthsToCross = Number(ceilDiv(cumulativeNeeded, extraMonthlyMinor))
    const crossDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthsToCross, today.getUTCDate())
    )
    steps.push({
      cardId: card.id,
      paydownNeededMinor: needed,
      monthsToCross,
      crossDate,
      monthlySavingsMinor: estMonthlyInterestMinor(needed, card.regularAprBps, false),
    })
  }
  return steps
}
