import { DAYS_PER_MONTH, daysUntil } from "./days"
import { estMonthlyInterestMinor } from "./interest"
import type { Minor } from "./money"
import { ceilDiv, maxMinor } from "./money"
import type { FinanceCard } from "./types"

export interface PromoPayoffPlan {
  cardId: string
  daysLeft: number
  /** Whole monthly payments that still fit before the promo ends (min 1). */
  paymentsLeft: number
  /** $/mo needed to clear the sheltered balance in time (ceil — never undershoots). */
  requiredMonthlyMinor: Minor
  /** The card's recorded minimum, when known. */
  currentMonthlyMinor: Minor | null
  /** Balance left at promo end if only the minimum is paid. */
  projectedRemainingMinor: Minor | null
  /** What that leftover costs per month at the post-promo APR (estimate — render with "~"). */
  postPromoMonthlyInterestMinor: Minor | null
  /** null when no minimum is recorded — nudge, never guess. */
  onTrack: boolean | null
}

/**
 * Payoff plan for one card's active 0% promo, or null when there is nothing
 * to plan: no promo, promo expired, or zero sheltered balance.
 *
 * daysLeft = 0 (promo ends today) still yields one payment, due now.
 */
export function promoPayoff(card: FinanceCard, today: Date): PromoPayoffPlan | null {
  if (card.promo == null) return null
  const daysLeft = daysUntil(card.promo.endsOn, today)
  if (daysLeft < 0) return null
  const balance = card.promo.shelteredBalanceMinor
  if (balance <= 0n) return null

  const paymentsLeft = Math.max(1, Math.floor(daysLeft / DAYS_PER_MONTH))
  const requiredMonthlyMinor = ceilDiv(balance, BigInt(paymentsLeft))
  const currentMonthlyMinor = card.minimumPaymentMinor
  const projectedRemainingMinor =
    currentMonthlyMinor == null
      ? null
      : maxMinor(0n, balance - currentMonthlyMinor * BigInt(paymentsLeft))
  const postPromoMonthlyInterestMinor =
    projectedRemainingMinor != null && projectedRemainingMinor > 0n
      ? estMonthlyInterestMinor(projectedRemainingMinor, card.promo.regularAprBpsAfter, false)
      : null

  return {
    cardId: card.id,
    daysLeft,
    paymentsLeft,
    requiredMonthlyMinor,
    currentMonthlyMinor,
    projectedRemainingMinor,
    postPromoMonthlyInterestMinor,
    onTrack: projectedRemainingMinor == null ? null : projectedRemainingMinor === 0n,
  }
}

/** Plans for every card with an active promo and a sheltered balance, most urgent first. */
export function promoPayoffPlans(cards: FinanceCard[], today: Date): PromoPayoffPlan[] {
  return cards
    .map((c) => promoPayoff(c, today))
    .filter((p): p is PromoPayoffPlan => p != null)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}
