/** Status-engine conformance (Blueprint EDR-003 — badge resolution is locked). */
import { describe, expect, it } from "vitest"

import { resolveAlert, resolveStatusBadge, type AlertInput } from "@/features/cards/utils/card-status"

const TODAY = new Date(Date.UTC(2026, 6, 11))

const input = (over: Partial<AlertInput> & { id: string }): AlertInput => ({
  balanceMinor: 0n,
  limitMinor: null,
  regularAprBps: null,
  minimumPaymentMinor: null,
  promo: null,
  dueInDays: null,
  dueCovered: false,
  ...over,
})

describe("alert priority stack", () => {
  it("PROMO_EXPIRED > PROMO_ENDING_SOON > HIGH_UTILIZATION > DUE_SOON > OK", () => {
    expect(resolveAlert(input({ id: "a", promo: { endsOn: new Date(Date.UTC(2026, 6, 1)), shelteredBalanceMinor: 100n, regularAprBpsAfter: 2000 } }), TODAY)).toBe("PROMO_EXPIRED")
    expect(resolveAlert(input({ id: "b", balanceMinor: 90000n, limitMinor: 100000n, promo: { endsOn: new Date(Date.UTC(2026, 7, 1)), shelteredBalanceMinor: 100n, regularAprBpsAfter: 2000 } }), TODAY)).toBe("PROMO_ENDING_SOON")
    expect(resolveAlert(input({ id: "c", balanceMinor: 90000n, limitMinor: 100000n }), TODAY)).toBe("HIGH_UTILIZATION")
    expect(resolveAlert(input({ id: "d", dueInDays: 3 }), TODAY)).toBe("DUE_SOON")
    expect(resolveAlert(input({ id: "e", dueInDays: 3, dueCovered: true }), TODAY)).toBe("OK")
  })
  it("zero-balance promos do not alert (tracker: Slate ····0926)", () => {
    expect(resolveAlert(input({ id: "f", promo: { endsOn: new Date(Date.UTC(2026, 7, 1)), shelteredBalanceMinor: 0n, regularAprBpsAfter: 1440 } }), TODAY)).toBe("OK")
  })
})

describe("badge resolution (EMP#2067 §4 worked example)", () => {
  it("FROZEN outranks alerts; connection state never appears", () => {
    // FROZEN + PROMO_ENDING_SOON (+ SYNC_FAILED, which is not this function's business)
    expect(resolveStatusBadge("FROZEN", "PROMO_ENDING_SOON")).toBe("FROZEN")
    expect(resolveStatusBadge("ARCHIVED", "OK")).toBe("ARCHIVED")
    expect(resolveStatusBadge("ACTIVE", "HIGH_UTILIZATION")).toBe("HIGH_UTILIZATION")
    expect(resolveStatusBadge("ACTIVE", "OK")).toBe("OK")
  })
})
