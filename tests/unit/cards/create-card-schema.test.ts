/**
 * Create-card schema (issue #26): FormData strings in → CreateCardInput
 * out. Field-error paths must match the form field names so the UI can
 * render them under the right inputs.
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { createCardSchema } from "@/features/cards/schemas/create-card-schema"

function fieldErrors(input: Record<string, string>) {
  const parsed = createCardSchema.safeParse(input)
  if (parsed.success) throw new Error("expected schema failure")
  return z.flattenError(parsed.error).fieldErrors as Record<string, string[]>
}

describe("createCardSchema", () => {
  it("parses the full happy path", () => {
    const parsed = createCardSchema.safeParse({
      cardName: "  Quicksilver (Marti) ",
      issuer: "Capital One",
      lastFour: "0042",
      creditLimit: "9,750.00",
      currentBalance: "1234.56",
      hasPromo: "on",
      promoEndsOn: "2027-03-15",
      regularApr: "22.74",
      paymentDueDay: "19",
      statementCloseDay: "24",
      minimumPayment: "68.00",
      paymentNote: "$350/month",
      notes: "Bonus deadline in May",
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).toEqual({
      cardName: "Quicksilver (Marti)",
      issuer: "Capital One",
      lastFour: "0042",
      creditLimitMinor: 975000n,
      currentBalanceMinor: 123456n,
      hasPromo: true,
      promoEndsOn: new Date("2027-03-15T00:00:00Z"),
      regularAprBps: 2274,
      paymentDueDay: 19,
      statementCloseDay: 24,
      minimumPaymentMinor: 6800n,
      paymentNote: "$350/month",
      notes: "Bonus deadline in May",
    })
  })

  it("parses the minimal card: name + issuer only", () => {
    const parsed = createCardSchema.safeParse({ cardName: "Card", issuer: "Bank" })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).toEqual({
      cardName: "Card",
      issuer: "Bank",
      lastFour: null,
      creditLimitMinor: null,
      currentBalanceMinor: 0n,
      hasPromo: false,
      promoEndsOn: null,
      regularAprBps: null,
      paymentDueDay: null,
      statementCloseDay: null,
      minimumPaymentMinor: null,
      paymentNote: null,
      notes: null,
    })
  })

  it("requires cardName and issuer with user-facing messages", () => {
    const errors = fieldErrors({ cardName: "", issuer: "  " })
    expect(errors.cardName).toEqual(["Give the card a name."])
    expect(errors.issuer).toEqual(["Enter the issuer."])
  })

  describe("lastFour", () => {
    it("accepts 4 digits and strips formatting spaces/dashes", () => {
      for (const input of ["0042", "00-42", " 0042 "]) {
        const parsed = createCardSchema.safeParse({ cardName: "C", issuer: "B", lastFour: input })
        expect(parsed.success).toBe(true)
        if (parsed.success) expect(parsed.data.lastFour).toBe("0042")
      }
    })

    it("rejects mixed input instead of silently extracting digits", () => {
      // "12ab34" must error — stripping letters to get "1234" would be misleading.
      expect(fieldErrors({ cardName: "C", issuer: "B", lastFour: "12ab34" }).lastFour).toBeDefined()
      expect(fieldErrors({ cardName: "C", issuer: "B", lastFour: "123" }).lastFour).toBeDefined()
      expect(fieldErrors({ cardName: "C", issuer: "B", lastFour: "12345" }).lastFour).toBeDefined()
    })

    it("treats empty as null", () => {
      const parsed = createCardSchema.safeParse({ cardName: "C", issuer: "B", lastFour: "" })
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.lastFour).toBeNull()
    })
  })

  describe("money fields", () => {
    it("rejects a zero credit limit but accepts a zero balance", () => {
      expect(fieldErrors({ cardName: "C", issuer: "B", creditLimit: "0" }).creditLimit).toBeDefined()
      const parsed = createCardSchema.safeParse({ cardName: "C", issuer: "B", currentBalance: "0" })
      expect(parsed.success && parsed.data.currentBalanceMinor === 0n).toBe(true)
    })

    it("rejects malformed amounts", () => {
      expect(fieldErrors({ cardName: "C", issuer: "B", creditLimit: "12.345" }).creditLimit).toBeDefined()
      expect(fieldErrors({ cardName: "C", issuer: "B", minimumPayment: "-5" }).minimumPayment).toBeDefined()
    })
  })

  describe("promo cross-field rule", () => {
    it("requires promoEndsOn when the promo switch is on", () => {
      const errors = fieldErrors({ cardName: "C", issuer: "B", hasPromo: "on" })
      expect(errors.promoEndsOn).toEqual(["Enter when the 0% promo ends."])
    })

    it("ignores a stale promoEndsOn when the switch is off", () => {
      const parsed = createCardSchema.safeParse({
        cardName: "C",
        issuer: "B",
        promoEndsOn: "2027-03-15",
      })
      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      expect(parsed.data.hasPromo).toBe(false)
      expect(parsed.data.promoEndsOn).toBeNull()
    })

    it("accepts a past end date — expired promos are legal data", () => {
      const parsed = createCardSchema.safeParse({
        cardName: "C",
        issuer: "B",
        hasPromo: "on",
        promoEndsOn: "2020-01-01",
      })
      expect(parsed.success).toBe(true)
    })

    it("rejects impossible calendar dates", () => {
      const errors = fieldErrors({
        cardName: "C",
        issuer: "B",
        hasPromo: "on",
        promoEndsOn: "2026-02-31",
      })
      expect(errors.promoEndsOn).toBeDefined()
    })
  })

  describe("day-of-month fields", () => {
    it("rejects 0 and 32", () => {
      expect(fieldErrors({ cardName: "C", issuer: "B", paymentDueDay: "0" }).paymentDueDay).toBeDefined()
      expect(
        fieldErrors({ cardName: "C", issuer: "B", statementCloseDay: "32" }).statementCloseDay
      ).toBeDefined()
    })

    it("accepts the bounds", () => {
      const parsed = createCardSchema.safeParse({
        cardName: "C",
        issuer: "B",
        paymentDueDay: "1",
        statementCloseDay: "31",
      })
      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      expect(parsed.data.paymentDueDay).toBe(1)
      expect(parsed.data.statementCloseDay).toBe(31)
    })
  })
})
