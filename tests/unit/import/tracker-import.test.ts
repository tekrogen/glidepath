/**
 * Tracker-import mapper conformance (Blueprint F16 / Level 11).
 *
 * Fixtures replicate the origin tracker's real edge rows — duplicate
 * last-fours, "xxxx" placeholders, missing APRs with live balances,
 * 100% utilization, free-text payment amounts, owner attribution in
 * parentheses — without reading the (local-only) xlsx in CI.
 */
import { describe, expect, it } from "vitest"

import {
  aprFractionToBps,
  normalizeLastFour,
  parseMinimumFromText,
  parseTrackerRow,
  splitOwner,
  toMinor,
  type TrackerRow,
} from "@/features/cards/server/tracker-import"

const row = (over: Partial<TrackerRow>): TrackerRow => ({
  cardName: null,
  lastFour: null,
  issuer: null,
  currentBalance: null,
  availableCredit: null,
  hasIntroApr: null,
  introAprEndDate: null,
  regularApr: null,
  paymentDueDay: null,
  paymentText: null,
  notes: null,
  ...over,
})

describe("primitives", () => {
  it("money and APR conversions are exact", () => {
    expect(toMinor(732.24)).toBe(73224n)
    expect(aprFractionToBps(0.1924)).toBe(1924)
    expect(aprFractionToBps(0.2974)).toBe(2974)
  })

  it("owner attribution strips parens; Shared means no owner", () => {
    expect(splitOwner("Quicksilver (Marti)")).toEqual({ name: "Quicksilver", owner: "Marti" })
    expect(splitOwner("US Bank Shield (Bob)")).toEqual({ name: "US Bank Shield", owner: "Bob" })
    expect(splitOwner("Amazon Visa (Shared)")).toEqual({ name: "Amazon Visa", owner: null })
    expect(splitOwner("Slate")).toEqual({ name: "Slate", owner: null })
  })

  it("last-four keeps leading zeros, rejects placeholders", () => {
    expect(normalizeLastFour("0037")).toEqual({ lastFour: "0037", warning: null })
    expect(normalizeLastFour(37)).toEqual({ lastFour: "0037", warning: null })
    expect(normalizeLastFour("xxxx").lastFour).toBeNull()
    expect(normalizeLastFour(null).lastFour).toBeNull()
  })

  it("payment text parses plain amounts, keeps prose as note-only", () => {
    expect(parseMinimumFromText("$350/month")).toBe(35000n)
    expect(parseMinimumFromText("$1,692.25")).toBe(169225n)
    expect(parseMinimumFromText("Statement Amt")).toBeNull()
  })
})

describe("parseTrackerRow — real tracker fixtures", () => {
  it("maps a plain card (Quicksilver): limit = balance + available", () => {
    const c = parseTrackerRow(
      row({
        cardName: "Quicksilver (Marti)",
        lastFour: "8391",
        issuer: "Capital One",
        currentBalance: 732.24,
        availableCredit: 9017.26,
        hasIntroApr: "No",
        regularApr: 0.134,
        paymentDueDay: 19,
        paymentText: "Statement Amt",
      })
    )!
    expect(c.cardName).toBe("Quicksilver")
    expect(c.ownerLabel).toBe("Marti")
    expect(c.issuerKey).toBe("capitalone")
    expect(c.creditLimitMinor).toBe(974950n) // 732.24 + 9017.26
    expect(c.regularAprBps).toBe(1340)
    expect(c.minimumPaymentMinor).toBeNull()
    expect(c.paymentNote).toBe("Statement Amt")
    expect(c.promo).toBeNull()
  })

  it("maps a promo card (USAA): APR moves to the promo's after-rate", () => {
    const c = parseTrackerRow(
      row({
        cardName: "Rate Advantage Plat. Visa (Marti)",
        lastFour: "9463",
        issuer: "USAA",
        currentBalance: 4234,
        availableCredit: 15766,
        hasIntroApr: "Yes",
        introAprEndDate: new Date(Date.UTC(2026, 9, 1)),
        regularApr: 0.1924,
        paymentDueDay: 9,
        paymentText: "$350/month",
      })
    )!
    expect(c.promo).toEqual({ endsOn: new Date(Date.UTC(2026, 9, 1)), regularAprBpsAfter: 1924 })
    expect(c.regularAprBps).toBeNull() // lives on the promo while active
    expect(c.minimumPaymentMinor).toBe(35000n)
    expect(c.creditLimitMinor).toBe(2000000n)
  })

  it("warns on unknown APR with a live balance (United Explorer) and missing due day", () => {
    const c = parseTrackerRow(
      row({
        cardName: "United Explorer",
        lastFour: "2461",
        issuer: "Chase",
        currentBalance: 5545,
        availableCredit: 21455,
        hasIntroApr: "No",
      })
    )!
    expect(c.regularAprBps).toBeNull()
    expect(c.warnings.join(" ")).toMatch(/APR unknown/)
    expect(c.warnings.join(" ")).toMatch(/due day unknown/)
  })

  it("handles 100% utilization (Strata: available 0) and odd issuers", () => {
    const c = parseTrackerRow(
      row({
        cardName: "Citbank Strata",
        lastFour: "9745",
        issuer: "Citibank",
        currentBalance: 3000,
        availableCredit: 0,
        hasIntroApr: "Yes",
        introAprEndDate: new Date(Date.UTC(2027, 3, 15)),
        regularApr: 0.2974,
        notes: "Thank You Points (33073 = $367)",
      })
    )!
    expect(c.creditLimitMinor).toBe(300000n)
    expect(c.notes).toContain("Thank You Points")

    const odd = parseTrackerRow(
      row({ cardName: "Ally/Olle", lastFour: "7219", issuer: "Ally/Olle", availableCredit: 5500, currentBalance: 0 })
    )!
    expect(odd.issuerKey).toBeNull()
    expect(odd.warnings.join(" ")).toMatch(/no known key/)
  })

  it("placeholder last-four ('xxxx') and blank rows", () => {
    const c = parseTrackerRow(
      row({ cardName: "United Business Card", lastFour: "xxxx", issuer: "Chase", currentBalance: 0, availableCredit: 17000 })
    )!
    expect(c.lastFour).toBeNull()
    expect(c.warnings.join(" ")).toMatch(/placeholder/)
    expect(parseTrackerRow(row({}))).toBeNull()
    expect(parseTrackerRow(row({ cardName: "   " }))).toBeNull()
  })

  it("duplicate names and last-fours survive as distinct cards (two Slates, 7727 twice)", () => {
    const a = parseTrackerRow(row({ cardName: "Slate", lastFour: "0926", issuer: "Chase", currentBalance: 0, availableCredit: 7800 }))!
    const b = parseTrackerRow(row({ cardName: "Slate", lastFour: "6076", issuer: "Chase", currentBalance: 6838.05, availableCredit: 961.95 }))!
    expect(a.cardName).toBe(b.cardName)
    expect(a.lastFour).not.toBe(b.lastFour) // match key must include lastFour + issuer
  })

  it("promo claimed without an end date never creates a promo silently", () => {
    const c = parseTrackerRow(
      row({ cardName: "Mystery", issuer: "Chase", currentBalance: 100, availableCredit: 900, hasIntroApr: "Yes", regularApr: 0.2 })
    )!
    expect(c.promo).toBeNull()
    expect(c.regularAprBps).toBe(2000) // APR stays on the card
    expect(c.warnings.join(" ")).toMatch(/no end date/)
  })
})
