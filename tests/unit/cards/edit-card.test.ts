/**
 * Edit-card pure rules (issue #47): the edit schema shares create's
 * parsers plus the id; the update mapping keeps create's conventions
 * minus syncStatus; the audit diff names changed fields only.
 */
import { describe, expect, it } from "vitest"

import { editCardSchema } from "@/features/cards/schemas/edit-card-schema"
import {
  changedCardFields,
  toUpdateCardData,
  type UpdateCardData,
} from "@/features/cards/server/create-card-data"

const FORM = {
  cardId: "card-1",
  cardName: "Meridian Blue",
  issuer: "Chase",
  lastFour: "4412",
  creditLimit: "5,000.00",
  currentBalance: "2140.00",
  regularApr: "19.24",
  paymentDueDay: "22",
  statementCloseDay: "27",
  minimumPayment: "85.00",
  ownerMemberId: "member-1",
}

describe("editCardSchema", () => {
  it("parses the shared fields plus the id", () => {
    const parsed = editCardSchema.safeParse(FORM)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.cardId).toBe("card-1")
    expect(parsed.data.creditLimitMinor).toBe(500000n)
    expect(parsed.data.regularAprBps).toBe(1924)
    expect(parsed.data.ownerMemberId).toBe("member-1")
  })

  it("rejects a missing card id", () => {
    const { cardId: _omitted, ...rest } = FORM
    const parsed = editCardSchema.safeParse(rest)
    expect(parsed.success).toBe(false)
  })

  it("applies the shared rules: bad money rejected, promo needs an end date", () => {
    expect(editCardSchema.safeParse({ ...FORM, creditLimit: "abc" }).success).toBe(false)
    expect(editCardSchema.safeParse({ ...FORM, hasPromo: "on" }).success).toBe(false)
  })

  it("empty owner ⇒ null (shared)", () => {
    const parsed = editCardSchema.safeParse({ ...FORM, ownerMemberId: " " })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.ownerMemberId).toBeNull()
  })
})

describe("toUpdateCardData", () => {
  const input = editCardSchema.parse(FORM)

  it("keeps create's conventions and never carries syncStatus", () => {
    const data = toUpdateCardData(input)
    expect("syncStatus" in data).toBe(false)
    expect(data.attribution).toBe("MEMBER")
    expect(data.limitSource).toBe("MANUAL")
    expect(data.creditLimitMinor).toBe(500000n)
  })

  it("promo on ⇒ card-level APR nulls, promo carries the after-rate + shelter", () => {
    const promoInput = editCardSchema.parse({
      ...FORM,
      hasPromo: "on",
      promoEndsOn: "2027-03-15",
    })
    const data = toUpdateCardData(promoInput)
    expect(data.regularAprBps).toBeNull()
    expect(data.promo).toEqual({
      endsOn: new Date("2027-03-15T00:00:00Z"),
      regularAprBpsAfter: 1924,
      shelteredBalanceMinor: 214000n,
    })
  })
})

describe("changedCardFields", () => {
  const data: UpdateCardData = toUpdateCardData(editCardSchema.parse(FORM))
  const unchanged: Record<string, unknown> = {
    cardName: "Meridian Blue",
    lastFour: "4412",
    issuer: "Chase",
    creditLimitMinor: 500000n,
    currentBalanceMinor: 214000n,
    regularAprBps: 1924,
    paymentDueDay: 22,
    statementCloseDay: 27,
    minimumPaymentMinor: 8500n,
    paymentNote: null,
    notes: null,
    ownerMemberId: "member-1",
    promoPeriods: [],
  }

  it("identical rows diff to nothing", () => {
    expect(changedCardFields(unchanged, data)).toEqual([])
  })

  it("names scalar, bigint, owner, and promo changes", () => {
    const before = {
      ...unchanged,
      cardName: "Old Name",
      creditLimitMinor: 100000n,
      ownerMemberId: null,
      promoPeriods: [{ endsOn: new Date("2026-10-01T00:00:00Z"), regularAprBpsAfter: 1924 }],
    }
    expect(changedCardFields(before, data)).toEqual([
      "cardName",
      "creditLimitMinor",
      "ownerMemberId",
      "promo",
    ])
  })

  it("null before (missing card) diffs to nothing", () => {
    expect(changedCardFields(null, data)).toEqual([])
  })
})
