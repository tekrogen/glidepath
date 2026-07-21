/**
 * Runway RSC-boundary serialization (issue #44): bigint minor units →
 * number cents, Dates → ISO days, resolved payments filtered. The
 * client reconstructs bigints from this DTO — a lossy or misnamed field
 * here silently corrupts every client-side lib/finance call.
 */
import { describe, expect, it } from "vitest"

import type { PaymentRunway } from "@/features/payments/server/service"
import { toRunwayViewProps } from "@/features/payments/utils/serialize"

const utc = (s: string) => new Date(`${s}T00:00:00Z`)

const runway: PaymentRunway = {
  cards: [
    {
      id: "card-1",
      cardName: "Meridian Blue",
      lifecycle: "ACTIVE",
      balanceMinor: 214000n,
      limitMinor: 500000n,
      regularAprBps: 1924,
      minimumPaymentMinor: 8500n,
      promo: {
        endsOn: utc("2027-02-01"),
        shelteredBalanceMinor: 423400n,
        regularAprBpsAfter: 2699,
      },
      paymentDueDay: 22,
      statementCloseDay: 27,
    },
    {
      id: "card-2",
      cardName: "Coastal CU",
      lifecycle: "FROZEN",
      balanceMinor: 0n,
      limitMinor: null,
      regularAprBps: null,
      minimumPaymentMinor: null,
      promo: null,
      paymentDueDay: null,
      statementCloseDay: null,
    },
  ],
  payments: [
    {
      id: "pay-1",
      cardId: "card-1",
      amountMinor: 8500n,
      scheduledFor: utc("2026-07-22"),
      status: "SCHEDULED",
    },
    {
      id: "pay-2",
      cardId: "card-1",
      amountMinor: 12692n,
      scheduledFor: utc("2026-07-09"),
      status: "DONE",
    },
  ],
  asOf: utc("2026-07-19"),
}

describe("toRunwayViewProps", () => {
  const props = toRunwayViewProps(runway)

  it("serializes bigint minor units to number cents", () => {
    expect(props.cards[0]).toEqual({
      id: "card-1",
      cardName: "Meridian Blue",
      lifecycle: "ACTIVE",
      balanceCents: 214000,
      limitCents: 500000,
      regularAprBps: 1924,
      minimumPaymentCents: 8500,
      promo: { endsOn: "2027-02-01", shelteredBalanceCents: 423400, regularAprBpsAfter: 2699 },
      paymentDueDay: 22,
      statementCloseDay: 27,
    })
  })

  it("preserves nulls instead of coercing to 0", () => {
    expect(props.cards[1].limitCents).toBeNull()
    expect(props.cards[1].minimumPaymentCents).toBeNull()
    expect(props.cards[1].promo).toBeNull()
  })

  it("keeps only SCHEDULED payments and serializes dates as ISO days", () => {
    expect(props.payments).toEqual([
      { id: "pay-1", cardId: "card-1", amountCents: 8500, scheduledFor: "2026-07-22" },
    ])
    expect(props.asOf).toBe("2026-07-19")
  })
})
