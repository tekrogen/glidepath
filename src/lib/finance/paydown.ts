import { daysUntil } from "./days"
import type { FinanceCard } from "./types"
import { isHighUtilization, utilization } from "./utilization"

/**
 * Two-tier paydown ranking (tracker rule, ported from Ebia PRO-002):
 * only high-utilization cards are ranked. Primary: utilization descending.
 * Tie-breaks: promo ending soonest, then larger balance.
 *
 * Cards with an unknown limit have undefined utilization and are never
 * ranked. Returns card id → 1-based priority.
 */
export function paydownRank(cards: FinanceCard[], today: Date): Map<string, number> {
  const ranked = cards
    .filter((c) => isHighUtilization(c.balanceMinor, c.limitMinor))
    .map((c) => ({
      id: c.id,
      utilization: utilization(c.balanceMinor, c.limitMinor) ?? 0,
      promoDays:
        c.promo != null && daysUntil(c.promo.endsOn, today) >= 0
          ? daysUntil(c.promo.endsOn, today)
          : Number.POSITIVE_INFINITY,
      balance: c.balanceMinor,
    }))
    .sort(
      (a, b) =>
        b.utilization - a.utilization ||
        a.promoDays - b.promoDays ||
        (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0)
    )

  return new Map(ranked.map((c, i) => [c.id, i + 1]))
}
