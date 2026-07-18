import { clampedUtcDate, daysUntil } from "./days"
import type { AprBps, Minor } from "./money"
import { ceilDiv } from "./money"
import type { FinanceCard } from "./types"
import { isPromoActive } from "./types"

export type DebtStrategy = "avalanche" | "snowball"

export interface DebtFreeStep {
  cardId: string
  /** Months of budget until this card is fully paid (cascade-cumulative). */
  payoffMonths: number
  /** Calendar date of the payoff (today + payoffMonths months). */
  payoffDate: Date
}

export interface DebtFreePlan {
  strategy: DebtStrategy
  /** Months until every balance reaches zero. 0 = already debt-free. */
  months: number
  debtFreeDate: Date
  /** Per-card payoff sequence in strategy order. */
  steps: DebtFreeStep[]
}

/** Ordering rate: a card sheltered by an active promo accrues at 0% today. */
function effectiveAprBps(card: FinanceCard, today: Date): AprBps | null {
  if (isPromoActive(card, today, daysUntil)) return 0
  return card.regularAprBps
}

/**
 * Avalanche/snowball debt-free projection (Blueprint Level 2: "avalanche
 * (APR desc) / snowball (balance asc) simulation, same assumptions as
 * what-if" — fixed APRs, no new purchases, no intra-projection
 * compounding). One monthly budget stream pays cards in strategy order;
 * without compounding the debt-free date is order-independent, but the
 * per-card payoff sequence is what the strategy toggle displays.
 *
 * Avalanche sorts by effective APR desc (active promos rate as 0%,
 * unknown APR last); among equal rates, active promos ending sooner sort
 * first — they resume accruing first (mirrors paydownRank's promo-end
 * tie-break). Snowball sorts by balance asc. Remaining ties keep input
 * order. Returns null when the budget is not positive (nothing to project).
 */
export function debtFreePlan(
  cards: FinanceCard[],
  strategy: DebtStrategy,
  monthlyBudgetMinor: Minor,
  today: Date
): DebtFreePlan | null {
  if (monthlyBudgetMinor <= 0n) return null

  const carrying = cards.filter((c) => c.balanceMinor > 0n)
  // Clamped month addition — Jan 31 + 1 month is Feb 28, never Mar 3.
  const monthDate = (months: number) =>
    clampedUtcDate(today.getUTCFullYear(), today.getUTCMonth() + months, today.getUTCDate())

  const promoEndMs = (c: FinanceCard) =>
    c.promo && isPromoActive(c, today, daysUntil) ? c.promo.endsOn.getTime() : null

  const ordered = [...carrying].sort((a, b) => {
    if (strategy === "snowball") {
      return a.balanceMinor === b.balanceMinor ? 0 : a.balanceMinor < b.balanceMinor ? -1 : 1
    }
    const aprA = effectiveAprBps(a, today)
    const aprB = effectiveAprBps(b, today)
    if (aprA !== aprB) {
      if (aprA == null) return 1
      if (aprB == null) return -1
      return aprB - aprA
    }
    const endA = promoEndMs(a)
    const endB = promoEndMs(b)
    if (endA != null && endB != null && endA !== endB) return endA - endB
    return 0
  })

  const steps: DebtFreeStep[] = []
  let cumulativeMinor = 0n
  for (const card of ordered) {
    cumulativeMinor += card.balanceMinor
    const payoffMonths = Number(ceilDiv(cumulativeMinor, monthlyBudgetMinor))
    steps.push({ cardId: card.id, payoffMonths, payoffDate: monthDate(payoffMonths) })
  }

  const months = steps.length === 0 ? 0 : steps[steps.length - 1].payoffMonths
  return { strategy, months, debtFreeDate: monthDate(months), steps }
}
