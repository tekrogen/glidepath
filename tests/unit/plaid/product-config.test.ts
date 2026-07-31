/**
 * Plaid Link product-config conformance (issue #108).
 */
import { Products } from "plaid"
import { describe, expect, it } from "vitest"

import { linkTokenProductOptions, parseProducts } from "@/lib/services/plaid-products"

describe("parseProducts", () => {
  it("parses the EDR-010/EDR-026 scope keys, including statements", () => {
    expect(parseProducts("transactions,liabilities,statements", "")).toEqual([
      Products.Transactions,
      Products.Liabilities,
      Products.Statements,
    ])
  })

  it("falls back when the env var is unset — default behavior unchanged", () => {
    expect(parseProducts(undefined, "transactions")).toEqual([Products.Transactions])
    expect(parseProducts(undefined, "")).toEqual([])
  })

  it("drops unknown keys and tolerates whitespace", () => {
    expect(parseProducts(" statements , investments , income ", "")).toEqual([
      Products.Statements,
    ])
  })
})

describe("linkTokenProductOptions (#158 — the statements object contract)", () => {
  const today = new Date("2026-07-31T12:00:00Z")

  it("EDR-026 target shape: optional statements carries the required date-range object", () => {
    expect(
      linkTokenProductOptions(
        [Products.Transactions, Products.Liabilities],
        [Products.Statements],
        today,
      ),
    ).toEqual({
      products: [Products.Transactions, Products.Liabilities],
      optional_products: [Products.Statements],
      statements: { start_date: "2025-07-31", end_date: "2026-07-31" },
    })
  })

  it("statements as a REQUIRED product also carries the object", () => {
    const opts = linkTokenProductOptions(
      [Products.Transactions, Products.Statements],
      [],
      today,
    )
    expect(opts.statements).toEqual({ start_date: "2025-07-31", end_date: "2026-07-31" })
    expect(opts).not.toHaveProperty("optional_products")
  })

  it("no statements requested → no statements field; empty optional list is omitted entirely", () => {
    const opts = linkTokenProductOptions(
      [Products.Transactions, Products.Liabilities],
      [Products.Identity],
      today,
    )
    expect(opts).toEqual({
      products: [Products.Transactions, Products.Liabilities],
      optional_products: [Products.Identity],
    })
    expect(linkTokenProductOptions([Products.Transactions], [], today)).toEqual({
      products: [Products.Transactions],
    })
  })
})
