import type { AprBps, Minor } from "./money"

/** Active 0% promo attached to a card. */
export interface FinancePromo {
  /** Last day the promo APR applies (date-only). */
  endsOn: Date
  /** Balance still sheltered at the promo APR. */
  shelteredBalanceMinor: Minor
  /** APR that kicks in when the promo ends. */
  regularAprBpsAfter: AprBps | null
}

/**
 * The minimal card shape every calculator accepts. Feature services map
 * Prisma rows into this at the boundary; no calculator touches the ORM.
 */
export interface FinanceCard {
  id: string
  balanceMinor: Minor
  /** null/0 limit ⇒ utilization is undefined (never Infinity). */
  limitMinor: Minor | null
  regularAprBps: AprBps | null
  minimumPaymentMinor: Minor | null
  promo: FinancePromo | null
}

export function isPromoActive(card: Pick<FinanceCard, "promo">, today: Date, daysUntilFn: (d: Date, t: Date) => number): boolean {
  return card.promo != null && daysUntilFn(card.promo.endsOn, today) >= 0
}
