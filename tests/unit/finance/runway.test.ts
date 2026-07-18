/**
 * Runway + debt-free conformance (issue #43, Blueprint Level 2 rows
 * `runwayAggregate` and `debtFreeDate`).
 *
 * Part 1 pins hand-computed worked examples; part 2 anchors both engines
 * to the SEED_VERSION 3 fixture to the cent — the seed IS the fixture.
 * TODAY is the dataset's rendered date.
 */
import { describe, expect, it } from "vitest"

import {
  debtFreePlan,
  runwayAggregate,
  RUNWAY_HORIZON_DAYS,
  type RunwayCard,
  type RunwayPayment,
} from "@/lib/finance"
import { SEED_CARDS } from "../../../prisma/seed-data/glidepath-cards"
import { SEED_SCHEDULED_PAYMENTS } from "../../../prisma/seed-data/glidepath-payments"

const TODAY = new Date(Date.UTC(2026, 6, 11)) // 2026-07-11, the Hi-Fi header date

const card = (over: Partial<RunwayCard> & { id: string }): RunwayCard => ({
  balanceMinor: 0n,
  limitMinor: null,
  regularAprBps: null,
  minimumPaymentMinor: null,
  promo: null,
  paymentDueDay: null,
  statementCloseDay: null,
  ...over,
})

const utc = (s: string) => new Date(`${s}T00:00:00Z`)

describe("runwayAggregate — worked example", () => {
  // A: due 15 ($35 min) with a $220 payment on Jul 14 covering the Jul 15 due;
  // B: due 4, minimum unknown; C: close day 28 only.
  const cards = [
    card({ id: "A", balanceMinor: 214000n, limitMinor: 500000n, minimumPaymentMinor: 3500n, paymentDueDay: 15 }),
    card({ id: "B", balanceMinor: 98000n, paymentDueDay: 4 }),
    card({ id: "C", balanceMinor: 50000n, statementCloseDay: 28 }),
  ]
  const payments: RunwayPayment[] = [
    { id: "p1", cardId: "A", amountMinor: 22000n, scheduledFor: utc("2026-07-14"), status: "SCHEDULED" },
  ]
  const agg = runwayAggregate(cards, payments, TODAY)

  it("window: 45 days, 7 weekly buckets, exclusive end", () => {
    expect(agg.horizonDays).toBe(RUNWAY_HORIZON_DAYS)
    expect(agg.horizonEnd).toEqual(utc("2026-08-25"))
    expect(agg.weeks).toHaveLength(7)
  })

  it("a 45-day window holds the same due day twice; the payment covers only the first", () => {
    const a = agg.lanes[0]
    const dues = a.events.filter((e) => e.kind === "due")
    expect(dues.map((e) => e.date)).toEqual([utc("2026-07-15"), utc("2026-08-15")])
    expect(dues.map((e) => e.covered)).toEqual([true, false])
    expect(a.events[0]).toMatchObject({ kind: "scheduled", amountMinor: 22000n, paymentId: "p1" })
  })

  it("past-this-month dues roll to next month; unknown minimums plot without cash", () => {
    const b = agg.lanes[1]
    expect(b.events).toHaveLength(1)
    expect(b.events[0]).toMatchObject({ kind: "due", date: utc("2026-08-04"), amountMinor: null, covered: false })
  })

  it("close events are informational — plotted, never cash", () => {
    const c = agg.lanes[2]
    expect(c.events).toEqual([
      { cardId: "C", date: utc("2026-07-28"), daysFromToday: 17, kind: "close", amountMinor: null },
    ])
  })

  it("cash = payments + uncovered known minimums: $220.00 (wk 0) + $35.00 (wk 5) = $255.00", () => {
    expect(agg.totalCashNeededMinor).toBe(25500n)
    expect(agg.weeks.map((w) => w.cashNeededMinor)).toEqual([22000n, 0n, 0n, 0n, 0n, 3500n, 0n])
  })

  it("lane labels carry balance + utilization", () => {
    expect(agg.lanes[0].utilization).toBeCloseTo(0.428, 3)
    expect(agg.lanes[1].utilization).toBeNull()
  })
})

describe("debtFreePlan — worked example", () => {
  // X 22.74% APR $8,097.69 · Y active promo (0% now) $3,166.28 · Z 19.24% $2,140.00
  const cards = [
    card({ id: "X", balanceMinor: 809769n, regularAprBps: 2274 }),
    card({
      id: "Y",
      balanceMinor: 316628n,
      regularAprBps: null,
      promo: { endsOn: utc("2027-09-05"), shelteredBalanceMinor: 316628n, regularAprBpsAfter: 1990 },
    }),
    card({ id: "Z", balanceMinor: 214000n, regularAprBps: 1924 }),
  ]

  it("avalanche: effective APR desc — active promo rates as 0% and goes last", () => {
    const plan = debtFreePlan(cards, "avalanche", 100000n, TODAY)!
    expect(plan.steps.map((s) => s.cardId)).toEqual(["X", "Z", "Y"])
    expect(plan.steps.map((s) => s.payoffMonths)).toEqual([9, 11, 14])
    expect(plan.months).toBe(14)
    expect(plan.debtFreeDate).toEqual(utc("2027-09-11"))
  })

  it("snowball: balance asc — same debt-free date, different sequence", () => {
    const plan = debtFreePlan(cards, "snowball", 100000n, TODAY)!
    expect(plan.steps.map((s) => s.cardId)).toEqual(["Z", "Y", "X"])
    expect(plan.steps.map((s) => s.payoffMonths)).toEqual([3, 6, 14])
    expect(plan.months).toBe(14)
  })

  it("guards: non-positive budget → null; no balances → 0 months", () => {
    expect(debtFreePlan(cards, "avalanche", 0n, TODAY)).toBeNull()
    const clean = debtFreePlan([card({ id: "N" })], "avalanche", 100000n, TODAY)!
    expect(clean.months).toBe(0)
    expect(clean.steps).toEqual([])
    expect(clean.debtFreeDate).toEqual(TODAY)
  })
})

// ── Seed-fixture anchors (SEED_VERSION 3) — exact to the cent ──

const seedRunwayCards: RunwayCard[] = SEED_CARDS.map((c) => ({
  id: c.cardName,
  balanceMinor: c.currentBalanceMinor,
  limitMinor: c.creditLimitMinor,
  regularAprBps: c.regularAprBps,
  minimumPaymentMinor: c.minimumPaymentMinor,
  promo: c.promo
    ? {
        endsOn: utc(c.promo.endsOn),
        shelteredBalanceMinor: c.currentBalanceMinor,
        regularAprBpsAfter: c.promo.regularAprBpsAfter,
      }
    : null,
  paymentDueDay: c.paymentDueDay,
  statementCloseDay: null,
}))

const seedRunwayPayments: RunwayPayment[] = SEED_SCHEDULED_PAYMENTS.map((p, i) => ({
  id: `seed-${i}`,
  cardId: p.cardName,
  amountMinor: p.amountMinor,
  scheduledFor: utc(p.scheduledFor),
  status: p.status,
}))

describe("runwayAggregate over the seed fixture", () => {
  const agg = runwayAggregate(seedRunwayCards, seedRunwayPayments, TODAY)

  it("18 lanes; $2,896.92 cash needed in the 45-day window", () => {
    expect(agg.lanes).toHaveLength(18)
    expect(agg.totalCashNeededMinor).toBe(289692n)
  })

  it("weekly cash buckets reconcile to the cent", () => {
    expect(agg.weeks.map((w) => w.cashNeededMinor)).toEqual([
      6800n, // wk0: Summit Travel due Jul 11 (today counts)
      18100n, // wk1: Atlas Flex + Fern Cash dues Jul 19, Meridian Blue payment Jul 22
      5500n, // wk2: Beacon Everyday payment Jul 27 (covers its Jul 27 due)
      221700n, // wk3: Cascade promo installment Aug 1 + Cobalt/Vertex dues
      19492n, // wk4: Quill Rewards due Aug 9 (its Jul 9 payment is DONE) + Summit Aug 11
      9600n, // wk5: Atlas + Fern second dues Aug 19
      8500n, // wk6: Meridian Blue second due Aug 22 (its payment covered Jul 22)
    ])
  })

  it("resolved fixture rows (DONE/SKIPPED) never plot", () => {
    const scheduled = agg.lanes.flatMap((l) => l.events.filter((e) => e.kind === "scheduled"))
    expect(scheduled).toHaveLength(3)
    expect(scheduled.map((e) => e.cardId).sort()).toEqual([
      "Beacon Everyday",
      "Cascade Platinum",
      "Meridian Blue",
    ])
  })
})

describe("debtFreePlan over the seed fixture ($2,000/mo)", () => {
  it("avalanche: Beacon Everyday first (highest accruing APR); debt-free May 2028", () => {
    const plan = debtFreePlan(seedRunwayCards, "avalanche", 200000n, TODAY)!
    expect(plan.steps).toHaveLength(11) // 11 seed cards carry a balance
    expect(plan.steps[0]).toMatchObject({ cardId: "Beacon Everyday", payoffMonths: 3 })
    expect(plan.months).toBe(22)
    expect(plan.debtFreeDate).toEqual(utc("2028-05-11"))
  })

  it("snowball reaches the same date via the smallest balance first", () => {
    const plan = debtFreePlan(seedRunwayCards, "snowball", 200000n, TODAY)!
    expect(plan.steps[0].cardId).toBe("Juniper Retail") // $308.15, smallest balance
    expect(plan.months).toBe(22)
  })
})
