/**
 * Plaid Link product-config conformance (issue #108).
 */
import { Products } from "plaid"
import { describe, expect, it } from "vitest"

import { parseProducts } from "@/lib/services/plaid-products"

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
