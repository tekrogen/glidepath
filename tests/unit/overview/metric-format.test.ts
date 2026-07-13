/**
 * Sparse-data display guards for the Overview metric grid (issue #29).
 * Asserts the one-card / limit-less / no-accrual portfolio never produces a
 * negative Available Credit, "across 0 cards", or a zeroed `~$0.00` estimate.
 */
import { describe, expect, it } from "vitest"

import {
  availableCreditDisplay,
  hasEstimatedInterest,
  shelteredSubtitle,
} from "@/features/overview/utils/metric-format"
import type { PortfolioSummary } from "@/lib/finance"

const summary = (over: Partial<PortfolioSummary> = {}): PortfolioSummary => ({
  totalLimitMinor: 0n,
  totalBalanceMinor: 0n,
  availableCreditMinor: 0n,
  overallUtilization: null,
  shelteredMinor: 0n,
  shelteredCardCount: 0,
  estMonthlyInterestMinor: 0n,
  totalMinimumPaymentsMinor: 0n,
  cardCount: 0,
  promosEndingWithin60Days: 0,
  nextPromoExpiration: null,
  ...over,
})

describe("availableCreditDisplay", () => {
  it("renders '—' when no card has a known limit (avoids a negative figure)", () => {
    // totalLimit 0 → availableCredit = 0 - balance = negative; must not surface.
    expect(availableCreditDisplay(summary({ totalLimitMinor: 0n, availableCreditMinor: -50000n }))).toBe("—")
  })

  it("renders the real figure once a limit is known", () => {
    expect(
      availableCreditDisplay(summary({ totalLimitMinor: 100000n, availableCreditMinor: 50000n }))
    ).toBe("$500.00")
  })
})

describe("shelteredSubtitle", () => {
  it("never says 'across 0 cards' when nothing is sheltered", () => {
    const text = shelteredSubtitle(summary({ shelteredCardCount: 0 }))
    expect(text).not.toMatch(/across 0/)
    expect(text).toBe("No balances sheltered at 0% APR")
  })

  it("uses singular 'card' for one sheltered card", () => {
    expect(shelteredSubtitle(summary({ shelteredCardCount: 1, shelteredMinor: 120000n }))).toBe(
      "$1,200.00 of balance sheltered at 0% APR across 1 card"
    )
  })

  it("matches the seeded 6-card copy (glidepath-pages e2e anchor)", () => {
    expect(shelteredSubtitle(summary({ shelteredCardCount: 6, shelteredMinor: 500000n }))).toContain(
      "of balance sheltered at 0% APR across 6 cards"
    )
  })
})

describe("hasEstimatedInterest", () => {
  it("is false for a zero estimate (no ~$0.00)", () => {
    expect(hasEstimatedInterest(summary({ estMonthlyInterestMinor: 0n }))).toBe(false)
  })

  it("is true for a real non-zero estimate", () => {
    expect(hasEstimatedInterest(summary({ estMonthlyInterestMinor: 9660n }))).toBe(true)
  })
})
