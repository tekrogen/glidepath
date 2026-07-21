/**
 * Payments boundary mappers (issue #44): Prisma-shaped rows →
 * lib/finance runway inputs. The card mapper must carry the day-of-month
 * anchors FinanceCard deliberately omits, and delegate the finance shape
 * to the cards mapper (one promo-selection rule, not two).
 */
import { describe, expect, it } from "vitest"

import {
  toRunwayCard,
  toRunwayPayment,
  type RunwayCardRowLike,
  type ScheduledPaymentRowLike,
} from "@/features/payments/server/mappers"

const utc = (s: string) => new Date(`${s}T00:00:00Z`)

const row = (over: Partial<RunwayCardRowLike> = {}): RunwayCardRowLike => ({
  id: "card-1",
  currentBalanceMinor: 214000n,
  creditLimitMinor: 500000n,
  regularAprBps: 1924,
  minimumPaymentMinor: 8500n,
  promoPeriods: [],
  paymentDueDay: 22,
  statementCloseDay: 27,
  ...over,
})

describe("toRunwayCard", () => {
  it("carries the finance shape plus both day-of-month anchors", () => {
    const card = toRunwayCard(row())
    expect(card).toEqual({
      id: "card-1",
      balanceMinor: 214000n,
      limitMinor: 500000n,
      regularAprBps: 1924,
      minimumPaymentMinor: 8500n,
      promo: null,
      paymentDueDay: 22,
      statementCloseDay: 27,
    })
  })

  it("preserves null anchors and unknown fields", () => {
    const card = toRunwayCard(
      row({
        creditLimitMinor: null,
        regularAprBps: null,
        minimumPaymentMinor: null,
        paymentDueDay: null,
        statementCloseDay: null,
      })
    )
    expect(card.limitMinor).toBeNull()
    expect(card.regularAprBps).toBeNull()
    expect(card.minimumPaymentMinor).toBeNull()
    expect(card.paymentDueDay).toBeNull()
    expect(card.statementCloseDay).toBeNull()
  })

  it("maps only an ACTIVE promo (the cards mapper's rule)", () => {
    const card = toRunwayCard(
      row({
        promoPeriods: [
          { status: "EXPIRED", endsOn: utc("2026-01-01"), shelteredBalanceMinor: 1n, regularAprBpsAfter: 2999 },
          { status: "ACTIVE", endsOn: utc("2027-02-01"), shelteredBalanceMinor: 423400n, regularAprBpsAfter: 2699 },
        ],
      })
    )
    expect(card.promo).toEqual({
      endsOn: utc("2027-02-01"),
      shelteredBalanceMinor: 423400n,
      regularAprBpsAfter: 2699,
    })
  })
})

describe("toRunwayPayment", () => {
  it("reduces a ScheduledPayment row to what the projection needs", () => {
    const payment: ScheduledPaymentRowLike = {
      id: "pay-1",
      cardId: "card-1",
      amountMinor: 8500n,
      scheduledFor: utc("2026-07-22"),
      status: "SCHEDULED",
    }
    expect(toRunwayPayment(payment)).toEqual({
      id: "pay-1",
      cardId: "card-1",
      amountMinor: 8500n,
      scheduledFor: utc("2026-07-22"),
      status: "SCHEDULED",
    })
  })
})
