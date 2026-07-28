/**
 * Plaid occurrence builder conformance (issue #109): stable un-dated
 * dedupeKeys (persist + honor dismissal until the condition clears),
 * per-item grouping for discoveries, per-card grouping for suggestions.
 */
import { describe, expect, it } from "vitest"

import { buildPlaidItems } from "@/features/notifications/utils/build-plaid-items"

const discovered = (id: string, itemId: string, institution = "First Gingham") => ({
  plaidAccountId: id,
  plaidItemId: itemId,
  name: "Plaid Credit Card",
  institutionName: institution,
  maskLabel: "...3333",
  balanceCents: 41032,
  currency: "USD",
})

const suggestion = (id: string, cardId: string, cardName = "Quicksilver") => ({
  id,
  cardId,
  cardName,
  field: "REGULAR_APR_BPS" as const,
  proposedValue: "2499",
  currentValue: "2550",
})

describe("buildPlaidItems", () => {
  it("groups discoveries per item with a stable un-dated dedupeKey", () => {
    const items = buildPlaidItems(
      [discovered("a", "item-1"), discovered("b", "item-1"), discovered("c", "item-2", "Platypus")],
      []
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      type: "CARD_DISCOVERED",
      dedupeKey: "CARD_DISCOVERED:plaiditem:item-1",
      body: "2 credit accounts at First Gingham can be imported as cards.",
      href: "/cards/import?source=plaid",
    })
    expect(items[1].body).toBe("1 credit account at Platypus can be imported as a card.")
  })

  it("groups suggestions per card; entityRef is card:<id>, never a lastFour", () => {
    const items = buildPlaidItems(
      [],
      [suggestion("s1", "card-1"), suggestion("s2", "card-1"), suggestion("s3", "card-2", "Slate")]
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      type: "PROVIDER_MISMATCH",
      entityRef: "card:card-1",
      dedupeKey: "PROVIDER_MISMATCH:card:card-1",
    })
    expect(items[0].body).toContain("2 values")
    expect(items[1].body).toContain("Slate")
  })

  it("empty inputs produce no occurrences", () => {
    expect(buildPlaidItems([], [])).toEqual([])
  })
})
