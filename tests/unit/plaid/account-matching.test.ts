/**
 * PlaidAccount identity-spine planner conformance (issue #107).
 *
 * The load-bearing rule under test: Plaid account_id is the only matching
 * key; masks are display-only. Adoption by mask exists solely as the one-time
 * backfill for pre-spine accounts, and refuses ambiguity — duplicate
 * last-fours are a real, intentionally seeded case.
 */
import { describe, expect, it } from "vitest"

import {
  formatPlaidMask,
  planAccountLinks,
  type LocalAccountCandidate,
} from "@/lib/services/plaid-account-matching"

const candidate = (over: Partial<LocalAccountCandidate>): LocalAccountCandidate => ({
  id: "local-1",
  accountNumber: "...1234",
  claimed: false,
  ...over,
})

describe("planAccountLinks", () => {
  it("routes linked accounts to update by account_id, ignoring mask changes", () => {
    const plan = planAccountLinks(
      [{ accountId: "plaid-a", mask: "...9999" }],
      [{ accountId: "plaid-a", userAccountId: "local-1" }],
      [candidate({ id: "local-1", accountNumber: "...1234" })]
    )
    expect(plan).toEqual([{ kind: "update", accountId: "plaid-a", userAccountId: "local-1" }])
  })

  it("adopts a pre-spine account when exactly one unclaimed mask match exists", () => {
    const plan = planAccountLinks(
      [{ accountId: "plaid-a", mask: "...1234" }],
      [],
      [candidate({ id: "local-1" })]
    )
    expect(plan).toEqual([{ kind: "adopt", accountId: "plaid-a", userAccountId: "local-1" }])
  })

  it("refuses adoption when two local accounts share the mask (duplicate last-fours)", () => {
    const plan = planAccountLinks(
      [{ accountId: "plaid-a", mask: "...1234" }],
      [],
      [
        candidate({ id: "local-1" }),
        candidate({ id: "local-2" }),
      ]
    )
    expect(plan).toEqual([{ kind: "create", accountId: "plaid-a" }])
  })

  it("two Plaid accounts sharing a mask never merge into one local account", () => {
    const plan = planAccountLinks(
      [
        { accountId: "plaid-a", mask: "...1234" },
        { accountId: "plaid-b", mask: "...1234" },
      ],
      [],
      [candidate({ id: "local-1" })]
    )
    // First adopts the single candidate; second must create, never share.
    expect(plan[0]).toEqual({ kind: "adopt", accountId: "plaid-a", userAccountId: "local-1" })
    expect(plan[1]).toEqual({ kind: "create", accountId: "plaid-b" })
  })

  it("never adopts an account already claimed by another link", () => {
    const plan = planAccountLinks(
      [{ accountId: "plaid-b", mask: "...1234" }],
      [],
      [candidate({ id: "local-1", claimed: true })]
    )
    expect(plan).toEqual([{ kind: "create", accountId: "plaid-b" }])
  })

  it("a severed link (deleted local account) recreates cleanly, no mask re-adoption", () => {
    const plan = planAccountLinks(
      [{ accountId: "plaid-a", mask: "...1234" }],
      [{ accountId: "plaid-a", userAccountId: null }],
      [candidate({ id: "local-9", accountNumber: "...1234" })]
    )
    expect(plan).toEqual([{ kind: "create", accountId: "plaid-a" }])
  })

  it("no mask match creates a fresh account", () => {
    const plan = planAccountLinks(
      [{ accountId: "plaid-a", mask: "...0037" }],
      [],
      [candidate({ accountNumber: "...1234" }), candidate({ id: "local-2", accountNumber: null })]
    )
    expect(plan).toEqual([{ kind: "create", accountId: "plaid-a" }])
  })
})

describe("formatPlaidMask", () => {
  it("prefers the issuer mask, preserving leading zeros", () => {
    expect(formatPlaidMask({ mask: "0037", account_id: "abcd9999" })).toBe("...0037")
  })

  it("falls back to the account_id tail when no mask exists", () => {
    expect(formatPlaidMask({ mask: null, account_id: "abcd9999" })).toBe("...9999")
  })
})
