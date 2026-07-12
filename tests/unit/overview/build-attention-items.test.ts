/**
 * Attention builder conformance (issue #25) — the builder formats the
 * portfolio's already-resolved alerts; it must never re-derive them.
 */
import { describe, expect, it } from "vitest"

import { buildAttentionItems } from "@/features/overview/utils/build-attention-items"
import type { PortfolioCard } from "@/features/cards/server/service"

const TODAY = new Date(Date.UTC(2026, 6, 11))

type CardOverrides = Partial<Omit<PortfolioCard, "finance">> & {
  id: string
  cardName: string
  finance?: Partial<PortfolioCard["finance"]>
}

const card = (over: CardOverrides): PortfolioCard => ({
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

const promo = (endsOn: string, shelteredBalanceMinor = 100000n) => ({
  endsOn: new Date(`${endsOn}T00:00:00Z`),
  shelteredBalanceMinor,
  regularAprBpsAfter: 1990,
})

const expired = card({
  id: "exp1",
  cardName: "Expired Promo",
  lastFour: "4412",
  alert: "PROMO_EXPIRED",
  statusBadge: "PROMO_EXPIRED",
  finance: { id: "exp1", balanceMinor: 100000n, promo: promo("2026-07-01") },
})
const ending = card({
  id: "end1",
  cardName: "Ending Promo",
  alert: "PROMO_ENDING_SOON",
  statusBadge: "PROMO_ENDING_SOON",
  finance: { id: "end1", balanceMinor: 50000n, promo: promo("2026-08-01", 50000n) },
})
const highUtil = card({
  id: "hu1",
  cardName: "Hot Card",
  alert: "HIGH_UTILIZATION",
  statusBadge: "HIGH_UTILIZATION",
  utilization: 0.9,
  finance: { id: "hu1", balanceMinor: 90000n, limitMinor: 100000n },
})
const dueSoon = card({
  id: "due1",
  cardName: "Due Card",
  alert: "DUE_SOON",
  statusBadge: "DUE_SOON",
  paymentDueDay: 14,
  finance: { id: "due1", balanceMinor: 10000n, minimumPaymentMinor: 3500n },
})
const syncFailed = card({
  id: "sf1",
  cardName: "Stale Card",
  syncStatus: "SYNC_FAILED",
})

describe("buildAttentionItems ordering", () => {
  it("sorts PROMO_EXPIRED > PROMO_ENDING_SOON > HIGH_UTILIZATION > DUE_SOON > SYNC_FAILED", () => {
    const items = buildAttentionItems([dueSoon, highUtil, syncFailed, ending, expired], TODAY)
    expect(items.map((i) => i.type)).toEqual([
      "PROMO_EXPIRED",
      "PROMO_ENDING_SOON",
      "HIGH_UTILIZATION",
      "DUE_SOON",
      "SYNC_FAILED",
    ])
  })

  it("breaks priority ties by card name", () => {
    const zed = card({ ...highUtil, id: "z1", cardName: "Zed" })
    const alpha = card({ ...highUtil, id: "a1", cardName: "Alpha" })
    const items = buildAttentionItems([zed, alpha], TODAY)
    expect(items.map((i) => i.cardId)).toEqual(["a1", "z1"])
  })

  it("returns [] for an empty portfolio", () => {
    expect(buildAttentionItems([], TODAY)).toEqual([])
  })
})

describe("dedupe keys (stable occurrence identity)", () => {
  it("promo keys carry the endsOn date; due keys carry the concrete due date", () => {
    const keys = buildAttentionItems([expired, ending, highUtil, dueSoon, syncFailed], TODAY).map(
      (i) => i.dedupeKey
    )
    expect(keys).toEqual([
      "PROMO_EXPIRED:card:exp1:2026-07-01",
      "PROMO_ENDING_SOON:card:end1:2026-08-01",
      "HIGH_UTILIZATION:card:hu1",
      "DUE_SOON:card:due1:2026-07-14",
      "SYNC_FAILED:card:sf1",
    ])
  })
})

describe("lifecycle and sync rules", () => {
  it("FROZEN cards still surface promo items (lifecycle outranks alerts only for the badge)", () => {
    const frozen = card({ ...ending, id: "frz1", cardName: "Frozen Promo", lifecycle: "FROZEN", statusBadge: "FROZEN" })
    const items = buildAttentionItems([frozen], TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe("PROMO_ENDING_SOON")
  })

  it("ARCHIVED cards are excluded entirely", () => {
    const archived = card({ ...highUtil, id: "arc1", lifecycle: "ARCHIVED", statusBadge: "ARCHIVED" })
    expect(buildAttentionItems([archived], TODAY)).toEqual([])
  })

  it("emits SYNC_FAILED for failed and disconnected cards, alongside any alert item", () => {
    const disconnected = card({ ...highUtil, id: "dc1", cardName: "Dropped Card", syncStatus: "DISCONNECTED" })
    const items = buildAttentionItems([disconnected, syncFailed], TODAY)
    expect(items.map((i) => i.type)).toEqual(["HIGH_UTILIZATION", "SYNC_FAILED", "SYNC_FAILED"])
    expect(items.filter((i) => i.cardId === "dc1")).toHaveLength(2)
  })
})

describe("body copy", () => {
  it("estimate figures carry the ~ prefix; card labels never omit the name", () => {
    const items = buildAttentionItems([expired, ending], TODAY)
    expect(items[0].body).toBe("Expired Promo ····4412 — 0% APR ended Jul 1 '26. ~$1,000.00 sheltered.")
    expect(items[1].body).toContain("~$500.00 sheltered")
    expect(items[1].body).toContain("0% APR ends Aug 1 '26 (21d)")
  })

  it("due-soon bodies carry the concrete date and minimum when known", () => {
    const [item] = buildAttentionItems([dueSoon], TODAY)
    expect(item.body).toBe("Due Card — payment due Jul 14 '26 (3d). Minimum $35.00.")
    expect(item.href).toBe("/cards")
    expect(item.entityRef).toBe("card:due1")
  })
})
