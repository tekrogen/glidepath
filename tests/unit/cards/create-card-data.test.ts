/**
 * Pure input→create-data mapping (issue #26): the seed/import persistence
 * conventions, unit-tested without a database. Also the first-household
 * naming derivation (zero-membership path).
 */
import { describe, expect, it } from "vitest"

import {
  deriveHouseholdIdentity,
  toCreateCardData,
} from "@/features/cards/server/create-card-data"
import type { CreateCardInput } from "@/features/cards/schemas/create-card-schema"

const base: CreateCardInput = {
  cardName: "Quicksilver",
  issuer: "Capital One",
  lastFour: "0042",
  creditLimitMinor: 975000n,
  currentBalanceMinor: 123456n,
  hasPromo: false,
  promoEndsOn: null,
  regularAprBps: 2274,
  paymentDueDay: 19,
  statementCloseDay: 24,
  minimumPaymentMinor: 6800n,
  paymentNote: "$350/month",
  notes: "note",
}

describe("toCreateCardData", () => {
  it("maps a no-promo card with card-level APR and MANUAL provenance", () => {
    const data = toCreateCardData(base)
    expect(data.regularAprBps).toBe(2274)
    expect(data.promo).toBeNull()
    expect(data.issuerKey).toBe("capitalone") // derived from issuer
    expect(data.limitSource).toBe("MANUAL")
    expect(data.aprSource).toBe("MANUAL")
    expect(data.minimumSource).toBe("MANUAL")
    expect(data.attribution).toBe("SHARED")
    expect(data.ownerMemberId).toBeNull()
    expect(data.syncStatus).toBe("MANUAL")
  })

  it("moves the APR onto the promo and shelters the balance when a promo is active", () => {
    const endsOn = new Date("2027-03-15T00:00:00Z")
    const data = toCreateCardData({ ...base, hasPromo: true, promoEndsOn: endsOn })
    expect(data.regularAprBps).toBeNull() // card-level APR null while promo active
    expect(data.promo).toEqual({
      endsOn,
      regularAprBpsAfter: 2274, // the post-promo rate
      shelteredBalanceMinor: 123456n, // = currentBalanceMinor
    })
    expect(data.aprSource).toBe("MANUAL") // promo counts as APR provenance
  })

  it("treats hasPromo without an end date as no promo (schema guards this, mapper is defensive)", () => {
    const data = toCreateCardData({ ...base, hasPromo: true, promoEndsOn: null })
    expect(data.promo).toBeNull()
    expect(data.regularAprBps).toBe(2274)
  })

  it("marks each source UNKNOWN when its value is absent (presence-based provenance)", () => {
    const data = toCreateCardData({
      ...base,
      creditLimitMinor: null,
      regularAprBps: null,
      minimumPaymentMinor: null,
    })
    expect(data.limitSource).toBe("UNKNOWN")
    expect(data.aprSource).toBe("UNKNOWN")
    expect(data.minimumSource).toBe("UNKNOWN")
  })

  it("keeps aprSource MANUAL from a promo even with no card-level APR", () => {
    const data = toCreateCardData({
      ...base,
      regularAprBps: null,
      hasPromo: true,
      promoEndsOn: new Date("2027-03-15T00:00:00Z"),
    })
    expect(data.aprSource).toBe("MANUAL")
    expect(data.promo?.regularAprBpsAfter).toBeNull()
  })

  it("maps the minimal card (name + issuer only)", () => {
    const data = toCreateCardData({
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
    expect(data.currentBalanceMinor).toBe(0n)
    expect(data.creditLimitMinor).toBeNull()
    expect(data.issuerKey).toBeNull() // "Bank" has no known key
    expect(data.limitSource).toBe("UNKNOWN")
    expect(data.aprSource).toBe("UNKNOWN")
    expect(data.minimumSource).toBe("UNKNOWN")
    expect(data.promo).toBeNull()
  })
})

describe("deriveHouseholdIdentity", () => {
  it("uses the first name for a named user", () => {
    expect(deriveHouseholdIdentity({ name: "Marti Dolce", email: "marti@x.com" })).toEqual({
      householdName: "Marti's Household",
      displayName: "Marti",
    })
  })

  it("falls back to the email local-part when there is no name", () => {
    expect(deriveHouseholdIdentity({ name: null, email: "demo@glidepath.cards" })).toEqual({
      householdName: "My Household",
      displayName: "demo",
    })
  })

  it("falls back to Owner / My Household with neither name nor email", () => {
    expect(deriveHouseholdIdentity(null)).toEqual({
      householdName: "My Household",
      displayName: "Owner",
    })
    expect(deriveHouseholdIdentity({ name: "   ", email: null })).toEqual({
      householdName: "My Household",
      displayName: "Owner",
    })
  })
})
