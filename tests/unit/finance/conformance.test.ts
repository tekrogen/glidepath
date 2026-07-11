/**
 * Formula-conformance suite (Blueprint Level 2 / Level 11).
 *
 * Anchors are real figures from the Hi-Fi mockup and the origin tracker —
 * exact to the cent, including rounding mode. If one of these fails after
 * a change to lib/finance, the formula spec in the blueprint changed or
 * the code is wrong; there is no third option.
 */
import { describe, expect, it } from "vitest"

import {
  ceilDiv,
  daysUntil,
  estMonthlyInterestMinor,
  isHighUtilization,
  paydownRank,
  portfolioSummary,
  promoPayoff,
  roundHalfAwayDiv,
  utilization,
  whatIfExtraPayment,
  type FinanceCard,
} from "@/lib/finance"

const TODAY = new Date(Date.UTC(2026, 6, 11)) // 2026-07-11, the Hi-Fi header date

const card = (over: Partial<FinanceCard> & { id: string }): FinanceCard => ({
  balanceMinor: 0n,
  limitMinor: null,
  regularAprBps: null,
  minimumPaymentMinor: null,
  promo: null,
  ...over,
})

describe("money rounding", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfAwayDiv(5n, 10n)).toBe(1n) // 0.5 → 1
    expect(roundHalfAwayDiv(4n, 10n)).toBe(0n) // 0.4 → 0
    expect(roundHalfAwayDiv(15n, 10n)).toBe(2n) // 1.5 → 2
  })
  it("ceilDiv never undershoots", () => {
    expect(ceilDiv(423400n, 2n)).toBe(211700n)
    expect(ceilDiv(100n, 3n)).toBe(34n)
  })
})

describe("estMonthlyInterest (EDR-020: balance × APR ÷ 12, half-away)", () => {
  it("matches the Hi-Fi what-if anchor: $5,097.69 at 22.74% → ~$96.60/mo", () => {
    expect(estMonthlyInterestMinor(509769n, 2274, false)).toBe(9660n)
  })
  it("is 0 while a promo shelters the balance", () => {
    expect(estMonthlyInterestMinor(509769n, 2274, true)).toBe(0n)
  })
  it("is null when APR unknown or balance non-positive (tracker: United Explorer)", () => {
    expect(estMonthlyInterestMinor(554500n, null, false)).toBeNull()
    expect(estMonthlyInterestMinor(0n, 2274, false)).toBeNull()
  })
})

describe("utilization", () => {
  it("null when limit unknown or zero — never Infinity", () => {
    expect(utilization(100n, null)).toBeNull()
    expect(utilization(100n, 0n)).toBeNull()
  })
  it("handles 100% utilization (tracker: Strata $3,000/$3,000)", () => {
    expect(utilization(300000n, 300000n)).toBe(1)
  })
  it("uses the exact fraction, not display rounding (Hi-Fi: Summit 30.0% shown, NOT high-util)", () => {
    // $6,838.05 / $22,800 = 0.29992… → renders 30.0% but is below threshold
    expect(utilization(683805n, 2280000n)).toBeCloseTo(0.29992, 4)
    expect(isHighUtilization(683805n, 2280000n)).toBe(false)
  })
})

describe("promoPayoff", () => {
  it("matches the Hi-Fi anchor: Cascade Platinum $4,234 ending Oct 1 '26 → 82d, 2 payments, $2,117.00/mo", () => {
    const plan = promoPayoff(
      card({
        id: "cascade",
        balanceMinor: 423400n,
        promo: { endsOn: new Date(Date.UTC(2026, 9, 1)), shelteredBalanceMinor: 423400n, regularAprBpsAfter: 1924 },
        minimumPaymentMinor: 4200n,
      }),
      TODAY
    )!
    expect(plan.daysLeft).toBe(82)
    expect(plan.paymentsLeft).toBe(2)
    expect(plan.requiredMonthlyMinor).toBe(211700n)
    expect(plan.onTrack).toBe(false)
    // At $42/mo min: $4,234 − $84 = $4,150 remains → ~$66.54/mo at 19.24%
    expect(plan.projectedRemainingMinor).toBe(415000n)
    expect(plan.postPromoMonthlyInterestMinor).toBe(6654n)
  })
  it("returns null for zero-balance promos (tracker: Slate ····0926)", () => {
    expect(
      promoPayoff(
        card({ id: "slate", promo: { endsOn: new Date(Date.UTC(2028, 0, 1)), shelteredBalanceMinor: 0n, regularAprBpsAfter: 1440 } }),
        TODAY
      )
    ).toBeNull()
  })
  it("returns null for expired promos; same-day promo yields 1 payment due now", () => {
    expect(
      promoPayoff(card({ id: "x", promo: { endsOn: new Date(Date.UTC(2026, 6, 10)), shelteredBalanceMinor: 100n, regularAprBpsAfter: 2000 } }), TODAY)
    ).toBeNull()
    const sameDay = promoPayoff(
      card({ id: "y", promo: { endsOn: TODAY, shelteredBalanceMinor: 100000n, regularAprBpsAfter: 2000 } }),
      TODAY
    )!
    expect(sameDay.paymentsLeft).toBe(1)
    expect(sameDay.requiredMonthlyMinor).toBe(100000n)
  })
  it("onTrack is null when no minimum is recorded — nudge, never guess", () => {
    const plan = promoPayoff(
      card({ id: "juniper", balanceMinor: 30815n, promo: { endsOn: new Date(Date.UTC(2027, 3, 15)), shelteredBalanceMinor: 30815n, regularAprBpsAfter: 2974 } }),
      TODAY
    )!
    expect(plan.onTrack).toBeNull()
    expect(plan.postPromoMonthlyInterestMinor).toBeNull()
  })
})

describe("paydownRank", () => {
  it("ranks only high-utilization cards: utilization desc, promo-end asc, balance desc", () => {
    const cards: FinanceCard[] = [
      card({ id: "horizon", balanceMinor: 809769n, limitMinor: 1000000n, regularAprBps: 2274 }), // 81.0%
      card({ id: "cobalt", balanceMinor: 316628n, limitMinor: 460000n, promo: { endsOn: new Date(Date.UTC(2027, 8, 5)), shelteredBalanceMinor: 316628n, regularAprBpsAfter: 1990 } }), // 68.8%
      card({ id: "fern", balanceMinor: 36200n, limitMinor: 975000n, regularAprBps: 1340 }), // 3.7%
      card({ id: "nolimit", balanceMinor: 999999n, limitMinor: null }), // unrankable
    ]
    const rank = paydownRank(cards, TODAY)
    expect(rank.get("horizon")).toBe(1)
    expect(rank.get("cobalt")).toBe(2)
    expect(rank.has("fern")).toBe(false)
    expect(rank.has("nolimit")).toBe(false)
  })
})

describe("whatIfExtraPayment", () => {
  it("matches the Hi-Fi anchor: $500/mo → Horizon crosses 30% in 11 payments, saving ~$96.60/mo", () => {
    const steps = whatIfExtraPayment(
      [card({ id: "horizon", balanceMinor: 809769n, limitMinor: 1000000n, regularAprBps: 2274 })],
      50000n,
      TODAY
    )
    expect(steps).toHaveLength(1)
    expect(steps[0].paydownNeededMinor).toBe(509769n)
    expect(steps[0].monthsToCross).toBe(11)
    expect(steps[0].monthlySavingsMinor).toBe(9660n)
  })
  it("cascades to the next ranked card with cumulative months", () => {
    const steps = whatIfExtraPayment(
      [
        card({ id: "a", balanceMinor: 80000n, limitMinor: 100000n, regularAprBps: 2000 }), // needs 50000
        card({ id: "b", balanceMinor: 90000n, limitMinor: 200000n, regularAprBps: 1000 }), // needs 30000
      ],
      10000n,
      TODAY
    )
    expect(steps.map((s) => s.cardId)).toEqual(["a", "b"])
    expect(steps[0].monthsToCross).toBe(5)
    expect(steps[1].monthsToCross).toBe(8) // (50000 + 30000) / 10000
  })
  it("returns [] for a non-positive extra amount", () => {
    expect(whatIfExtraPayment([card({ id: "a", balanceMinor: 80000n, limitMinor: 100000n })], 0n, TODAY)).toEqual([])
  })
})

describe("portfolioSummary", () => {
  it("splits sheltered vs accruing and skips unknown limits in totals", () => {
    const s = portfolioSummary(
      [
        card({ id: "a", balanceMinor: 100000n, limitMinor: 400000n, regularAprBps: 1200 }),
        card({ id: "b", balanceMinor: 200000n, limitMinor: 600000n, promo: { endsOn: new Date(Date.UTC(2026, 8, 1)), shelteredBalanceMinor: 200000n, regularAprBpsAfter: 2000 } }),
        card({ id: "c", balanceMinor: 50000n, limitMinor: null, regularAprBps: 2400 }),
      ],
      TODAY
    )
    expect(s.totalLimitMinor).toBe(1000000n)
    expect(s.totalBalanceMinor).toBe(350000n)
    expect(s.shelteredMinor).toBe(200000n)
    expect(s.shelteredCardCount).toBe(1)
    // a: 100000×1200/120000 = 1000 ; c: 50000×2400/120000 = 1000 ; b sheltered
    expect(s.estMonthlyInterestMinor).toBe(2000n)
    expect(s.promosEndingWithin60Days).toBe(1)
    expect(s.overallUtilization).toBeCloseTo(0.35, 5)
  })
})

describe("daysUntil", () => {
  it("is date-only UTC math (Hi-Fi: Jul 11 → Oct 1 = 82 days)", () => {
    expect(daysUntil(new Date(Date.UTC(2026, 9, 1)), TODAY)).toBe(82)
    expect(daysUntil(TODAY, TODAY)).toBe(0)
    expect(daysUntil(new Date(Date.UTC(2026, 6, 10)), TODAY)).toBe(-1)
  })
})
