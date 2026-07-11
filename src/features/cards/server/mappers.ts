/**
 * Boundary mappers: Prisma rows (and seed-shaped card literals) →
 * lib/finance inputs. No calculator ever touches the ORM (EDR-019).
 */
import type { FinanceCard, FinancePromo } from "@/lib/finance"

/** The row shape the mapper accepts — matches Prisma CreditCard + active promo. */
export interface CardRowLike {
  id: string
  currentBalanceMinor: bigint
  creditLimitMinor: bigint | null
  regularAprBps: number | null
  minimumPaymentMinor: bigint | null
  promoPeriods?: Array<{
    status: string
    endsOn: Date
    shelteredBalanceMinor: bigint
    regularAprBpsAfter: number | null
  }>
}

export function toFinanceCard(row: CardRowLike): FinanceCard {
  const active = row.promoPeriods?.find((p) => p.status === "ACTIVE") ?? null
  const promo: FinancePromo | null = active
    ? {
        endsOn: active.endsOn,
        shelteredBalanceMinor: active.shelteredBalanceMinor,
        regularAprBpsAfter: active.regularAprBpsAfter,
      }
    : null
  return {
    id: row.id,
    balanceMinor: row.currentBalanceMinor,
    limitMinor: row.creditLimitMinor,
    regularAprBps: row.regularAprBps,
    minimumPaymentMinor: row.minimumPaymentMinor,
    promo,
  }
}
