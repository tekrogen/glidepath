/**
 * Hi-Fi seed-dataset conformance (Blueprint EDR-018 / Level 11).
 *
 * The seed IS the fixture: these tests assert the Overview tiles and panel
 * figures from the Hi-Fi mockup, computed from the seed dataset through
 * lib/finance. If the dataset or a formula changes, this fails loudly
 * before any screenshot drifts.
 */
import { describe, expect, it } from "vitest"

import { SEED_CARDS, SEED_VERSION } from "../../../prisma/seed-data/glidepath-cards"
import { toFinanceCard } from "@/features/cards/server/mappers"
import {
  paydownRank,
  portfolioSummary,
  promoPayoffPlans,
  whatIfExtraPayment,
  type FinanceCard,
} from "@/lib/finance"

const TODAY = new Date(Date.UTC(2026, 6, 11)) // the Hi-Fi header date

const cards: FinanceCard[] = SEED_CARDS.map((c, i) =>
  toFinanceCard({
    id: c.cardName,
    currentBalanceMinor: c.currentBalanceMinor,
    creditLimitMinor: c.creditLimitMinor,
    regularAprBps: c.regularAprBps,
    minimumPaymentMinor: c.minimumPaymentMinor,
    promoPeriods: c.promo
      ? [
          {
            status: "ACTIVE",
            endsOn: new Date(`${c.promo.endsOn}T00:00:00Z`),
            shelteredBalanceMinor: c.currentBalanceMinor,
            regularAprBpsAfter: c.promo.regularAprBpsAfter,
          },
        ]
      : [],
  })
)

describe(`Hi-Fi dataset (SEED_VERSION ${SEED_VERSION})`, () => {
  it("is 18 cards", () => {
    // v3 = v2 card figures (unchanged) + the payment-domain fixture (issue #42)
    expect(SEED_VERSION).toBe(3)
    expect(cards).toHaveLength(18)
  })

  it("reconciles the Overview tiles exactly", () => {
    const s = portfolioSummary(cards, TODAY)
    expect(s.totalBalanceMinor).toBe(4396972n) // $43,969.72
    expect(s.totalLimitMinor).toBe(21585000n) // $215,850.00
    expect(s.overallUtilization! * 100).toBeCloseTo(20.4, 1) // 20.4%
    expect(s.totalMinimumPaymentsMinor).toBe(57292n) // $572.92/mo
    expect(s.estMonthlyInterestMinor).toBe(31141n) // ~$311.41/mo
    expect(s.nextPromoExpiration).toEqual(new Date(Date.UTC(2026, 9, 1))) // Oct 1
    // Documented mockup deviation: the tile claims $41,462 sheltered, but the
    // mockup's own cards table sums to $27,138.36 across 6 promos — data wins.
    expect(s.shelteredMinor).toBe(2713836n)
    expect(s.shelteredCardCount).toBe(6)
  })

  it("matches the Hi-Fi paydown priority panel (6 cards ≥ 30%, Horizon first)", () => {
    const rank = paydownRank(cards, TODAY)
    expect(rank.size).toBe(6)
    const order = [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)
    expect(order).toEqual([
      "Horizon Cash", // 81.0%
      "Cobalt One", // 68.8%
      "Vertex Rewards", // 65.1%
      "Atlas Flex", // 46.8%
      "Beacon Everyday", // 46.2%
      "Meridian Blue", // 42.8%
    ])
  })

  it("matches the promo payoff panel (6 plans, 5 off track at minimum, Cascade most urgent)", () => {
    const plans = promoPayoffPlans(cards, TODAY)
    expect(plans).toHaveLength(6)
    expect(plans[0].cardId).toBe("Cascade Platinum")
    expect(plans[0].daysLeft).toBe(82)
    expect(plans[0].requiredMonthlyMinor).toBe(211700n) // $2,117.00/mo
    expect(plans.filter((p) => p.onTrack === false)).toHaveLength(5) // "5 OFF TRACK AT MINIMUM"
    expect(plans.filter((p) => p.onTrack === null)).toHaveLength(1) // Juniper: no minimum recorded
  })

  it("matches the what-if slider anchor ($500/mo → Horizon crosses in 11, ~$96.60/mo saved)", () => {
    const steps = whatIfExtraPayment(cards, 50000n, TODAY)
    expect(steps[0].cardId).toBe("Horizon Cash")
    expect(steps[0].monthsToCross).toBe(11)
    expect(steps[0].monthlySavingsMinor).toBe(9660n)
  })

  it("keeps the deliberate real-data fixtures", () => {
    const byName = new Map(SEED_CARDS.map((c) => [c.cardName, c]))
    // duplicate last4 across issuers — never key on last4
    expect(byName.get("Horizon Cash")!.lastFour).toBe("7727")
    expect(byName.get("Cedar Line")!.lastFour).toBe("7727")
    // missing last4 and unknown APR with a known limit
    expect(byName.get("Sterling Simplicity")!.lastFour).toBeNull()
    expect(byName.get("Sterling Simplicity")!.regularAprBps).toBeNull()
    // missing due day
    expect(byName.get("Cedar Line")!.paymentDueDay).toBeNull()
  })
})
