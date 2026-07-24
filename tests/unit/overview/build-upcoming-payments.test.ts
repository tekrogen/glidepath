/**
 * Upcoming-payments builder conformance (issue #12) — derives the widget feed
 * from due dates already on the portfolio. Anchored to seed cards by NAME +
 * amount (date-independent); dates come from a fixed asOf.
 */
import { describe, expect, it } from "vitest"

import { buildUpcomingPayments } from "@/features/overview/utils/build-upcoming-payments"
import type { PortfolioCard } from "@/features/cards/server/service"

const ASOF = new Date(Date.UTC(2026, 6, 11)) // 2026-07-11

type CardOverrides = Partial<Omit<PortfolioCard, "finance">> & {
  id: string
  cardName: string
  finance?: Partial<PortfolioCard["finance"]>
}

const card = (over: CardOverrides): PortfolioCard => ({
  dueCovered: false,
  autopayActive: false,
  autopayProviderUrl: null,
  lastFour: null,
  issuer: "Chase",
  issuerKey: null,
  ownerLabel: null,
  lifecycle: "ACTIVE",
  statusBadge: "OK",
  alert: "OK",
  syncStatus: "MANUAL",
  utilization: null,
  paydownPriority: null,
  paymentDueDay: null,
  dueInDays: null,
  hasEstimatedInputs: false,
  ...over,
  finance: {
    id: over.id,
    balanceMinor: 0n,
    limitMinor: null,
    regularAprBps: null,
    minimumPaymentMinor: null,
    promo: null,
    ...over.finance,
  },
})

// Seed-anchored fixtures (name + recorded minimum).
const meridian = card({ id: "m", cardName: "Meridian Blue", lastFour: "4412", paymentDueDay: 22, finance: { id: "m", minimumPaymentMinor: 8500n } })
const quill = card({ id: "q", cardName: "Quill Rewards", lastFour: "3303", paymentDueDay: 9, finance: { id: "q", minimumPaymentMinor: 12692n } })
const atlas = card({ id: "a", cardName: "Atlas Flex", lastFour: "1652", paymentDueDay: 19, finance: { id: "a", minimumPaymentMinor: 6100n } })
// No due day → excluded (Cedar Line / Sterling Simplicity / Coastal CU shape).
const cedar = card({ id: "c", cardName: "Cedar Line", paymentDueDay: null })
const sterling = card({ id: "s", cardName: "Sterling Simplicity", paymentDueDay: null })
// Archived but with a due day → excluded.
const archived = card({ id: "arc", cardName: "Old Card", lifecycle: "ARCHIVED", paymentDueDay: 5, finance: { id: "arc", minimumPaymentMinor: 5000n } })
// Has a due day but no recorded minimum → included, minimum passes through null.
const noMin = card({ id: "nm", cardName: "Juniper Retail", paymentDueDay: 15, finance: { id: "nm", minimumPaymentMinor: null } })

describe("buildUpcomingPayments filtering", () => {
  it("excludes cards without a due day and archived cards", () => {
    const names = buildUpcomingPayments([meridian, cedar, sterling, archived], ASOF).map((i) => i.cardName)
    expect(names).toEqual(["Meridian Blue"])
  })

  it("returns [] for an empty portfolio", () => {
    expect(buildUpcomingPayments([], ASOF)).toEqual([])
  })
})

describe("buildUpcomingPayments ordering", () => {
  it("sorts ascending by next due date", () => {
    // Atlas Jul 19, Meridian Jul 22, Quill (day 9 passed) → Aug 9.
    const names = buildUpcomingPayments([quill, meridian, atlas], ASOF).map((i) => i.cardName)
    expect(names).toEqual(["Atlas Flex", "Meridian Blue", "Quill Rewards"])
  })

  it("breaks a same-date tie by card name", () => {
    const zed = card({ id: "z", cardName: "Zed", paymentDueDay: 22 })
    const alpha = card({ id: "al", cardName: "Alpha", paymentDueDay: 22 })
    const names = buildUpcomingPayments([zed, alpha], ASOF).map((i) => i.cardName)
    expect(names).toEqual(["Alpha", "Zed"])
  })
})

describe("buildUpcomingPayments amounts + dates", () => {
  it("passes recorded minimums straight through (no estimation)", () => {
    const byName = Object.fromEntries(
      buildUpcomingPayments([meridian, quill, atlas], ASOF).map((i) => [i.cardName, i.minimumPaymentMinor])
    )
    expect(byName["Meridian Blue"]).toBe(8500n) // $85.00
    expect(byName["Quill Rewards"]).toBe(12692n) // $126.92
    expect(byName["Atlas Flex"]).toBe(6100n) // $61.00
  })

  it("carries a null minimum through unchanged", () => {
    const [item] = buildUpcomingPayments([noMin], ASOF)
    expect(item.minimumPaymentMinor).toBeNull()
  })

  it("resolves the next due date from asOf (rolls past a passed due day)", () => {
    const items = buildUpcomingPayments([meridian, quill], ASOF)
    const byName = Object.fromEntries(items.map((i) => [i.cardName, i.dueDate]))
    expect(byName["Meridian Blue"]).toEqual(new Date(Date.UTC(2026, 6, 22))) // Jul 22
    expect(byName["Quill Rewards"]).toEqual(new Date(Date.UTC(2026, 7, 9))) // Aug 9
  })
})
