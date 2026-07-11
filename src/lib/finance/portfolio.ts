import { daysUntil } from "./days"
import { estMonthlyInterestMinor } from "./interest"
import type { Minor } from "./money"
import type { FinanceCard } from "./types"
import { isPromoActive } from "./types"
import { utilization } from "./utilization"

export interface PortfolioSummary {
  totalLimitMinor: Minor
  totalBalanceMinor: Minor
  availableCreditMinor: Minor
  /** Exact fraction; null when no card has a known limit. */
  overallUtilization: number | null
  /** Balance still sheltered by active 0% promos. */
  shelteredMinor: Minor
  shelteredCardCount: number
  /** Estimated monthly interest across non-promo balances (render with "~"). */
  estMonthlyInterestMinor: Minor
  totalMinimumPaymentsMinor: Minor
  cardCount: number
  promosEndingWithin60Days: number
  nextPromoExpiration: Date | null
}

/** Portfolio aggregates — the Overview tiles / tracker Summary sheet, verbatim. */
export function portfolioSummary(cards: FinanceCard[], today: Date): PortfolioSummary {
  let totalLimit = 0n
  let totalBalance = 0n
  let sheltered = 0n
  let shelteredCards = 0
  let interest = 0n
  let minimums = 0n
  const upcoming: Date[] = []

  for (const c of cards) {
    if (c.limitMinor != null && c.limitMinor > 0n) totalLimit += c.limitMinor
    totalBalance += c.balanceMinor
    const promoActive = isPromoActive(c, today, daysUntil)
    if (promoActive) {
      sheltered += c.promo!.shelteredBalanceMinor
      if (c.promo!.shelteredBalanceMinor > 0n) shelteredCards++
      if (daysUntil(c.promo!.endsOn, today) >= 0) upcoming.push(c.promo!.endsOn)
    } else {
      interest += estMonthlyInterestMinor(c.balanceMinor, c.regularAprBps, false) ?? 0n
    }
    if (c.minimumPaymentMinor != null) minimums += c.minimumPaymentMinor
  }

  upcoming.sort((a, b) => a.getTime() - b.getTime())

  return {
    totalLimitMinor: totalLimit,
    totalBalanceMinor: totalBalance,
    availableCreditMinor: totalLimit - totalBalance,
    overallUtilization: utilization(totalBalance, totalLimit > 0n ? totalLimit : null),
    shelteredMinor: sheltered,
    shelteredCardCount: shelteredCards,
    estMonthlyInterestMinor: interest,
    totalMinimumPaymentsMinor: minimums,
    cardCount: cards.length,
    promosEndingWithin60Days: upcoming.filter((d) => daysUntil(d, today) <= 60).length,
    nextPromoExpiration: upcoming[0] ?? null,
  }
}
