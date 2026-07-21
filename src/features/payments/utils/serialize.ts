/**
 * RSC-boundary serialization for the runway page (issue #44): bigint
 * minor units → number cents, Dates → ISO date strings. The client
 * reconstructs bigints and calls lib/finance itself (the what-if
 * precedent) — math stays in the finance lib on both sides (EDR-019).
 */
import type { PaymentRunway } from "../server/service"

export interface RunwayCardDto {
  id: string
  cardName: string
  lifecycle: "ACTIVE" | "FROZEN" | "ARCHIVED"
  balanceCents: number
  limitCents: number | null
  regularAprBps: number | null
  minimumPaymentCents: number | null
  promo: {
    endsOn: string
    shelteredBalanceCents: number
    regularAprBpsAfter: number | null
  } | null
  paymentDueDay: number | null
  statementCloseDay: number | null
}

export interface RunwayPaymentDto {
  id: string
  cardId: string
  amountCents: number
  scheduledFor: string
}

export interface RunwayViewProps {
  cards: RunwayCardDto[]
  payments: RunwayPaymentDto[]
  /** UTC date (yyyy-mm-dd) every projection is computed against. */
  asOf: string
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export function toRunwayViewProps(runway: PaymentRunway): RunwayViewProps {
  return {
    cards: runway.cards.map((c) => ({
      id: c.id,
      cardName: c.cardName,
      lifecycle: c.lifecycle,
      balanceCents: Number(c.balanceMinor),
      limitCents: c.limitMinor == null ? null : Number(c.limitMinor),
      regularAprBps: c.regularAprBps,
      minimumPaymentCents: c.minimumPaymentMinor == null ? null : Number(c.minimumPaymentMinor),
      promo: c.promo
        ? {
            endsOn: isoDay(c.promo.endsOn),
            shelteredBalanceCents: Number(c.promo.shelteredBalanceMinor),
            regularAprBpsAfter: c.promo.regularAprBpsAfter,
          }
        : null,
      paymentDueDay: c.paymentDueDay,
      statementCloseDay: c.statementCloseDay,
    })),
    payments: runway.payments
      .filter((p) => p.status === "SCHEDULED")
      .map((p) => ({
        id: p.id,
        cardId: p.cardId,
        amountCents: Number(p.amountMinor),
        scheduledFor: isoDay(p.scheduledFor),
      })),
    asOf: isoDay(runway.asOf),
  }
}
