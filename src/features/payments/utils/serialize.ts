/**
 * RSC-boundary serialization for the runway page (issue #44): bigint
 * minor units → number cents, Dates → ISO date strings. The client
 * reconstructs bigints and calls lib/finance itself (the what-if
 * precedent) — math stays in the finance lib on both sides (EDR-019).
 */
import type { PaymentRunway, PaymentSetup } from "../server/service"

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
  autopayActive: boolean
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

export interface FundingAccountDto {
  id: string
  name: string
  institution: string | null
  lastFour: string | null
}

export interface IntentDraftDto {
  intentId: string
  cardId: string | null
  amountCents: number | null
  scheduledFor: string | null
  fundingAccountId: string | null
  note: string | null
  /** Full ISO timestamp — expiry is time-exact, not date-only. */
  expiresAt: string
}

export interface PaymentStepperProps {
  cards: RunwayCardDto[]
  fundingAccounts: FundingAccountDto[]
  draft: IntentDraftDto | null
  asOf: string
}

export function toPaymentStepperProps(setup: PaymentSetup): PaymentStepperProps {
  return {
    cards: toRunwayViewProps({ cards: setup.cards, payments: [], asOf: setup.asOf }).cards,
    fundingAccounts: setup.fundingAccounts,
    draft: setup.draft
      ? {
          intentId: setup.draft.id,
          cardId: setup.draft.cardId,
          amountCents: setup.draft.amountMinor == null ? null : Number(setup.draft.amountMinor),
          scheduledFor: setup.draft.scheduledFor ? isoDay(setup.draft.scheduledFor) : null,
          fundingAccountId: setup.draft.fundingAccountId,
          note: setup.draft.note,
          expiresAt: setup.draft.expiresAt.toISOString(),
        }
      : null,
    asOf: isoDay(setup.asOf),
  }
}

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
      autopayActive: c.autopayActive,
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
