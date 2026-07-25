/**
 * Cron event attribution (issue #46): PaymentIntentExpired events need a
 * userId but the cron has no session — the household OWNER's user is the
 * recorded actor, any user-bearing member the fallback.
 */
import { describe, expect, it } from "vitest"

import { resolveHouseholdEventUser } from "@/features/payments/utils/intent"

describe("resolveHouseholdEventUser", () => {
  it("prefers the OWNER's user", () => {
    expect(
      resolveHouseholdEventUser([
        { userId: "member-user", role: "MEMBER" },
        { userId: "owner-user", role: "OWNER" },
      ])
    ).toBe("owner-user")
  })

  it("falls back to any member with a user when the OWNER has none", () => {
    expect(
      resolveHouseholdEventUser([
        { userId: null, role: "OWNER" },
        { userId: "member-user", role: "MEMBER" },
      ])
    ).toBe("member-user")
  })

  it("returns null for a household with no user-bearing members", () => {
    expect(resolveHouseholdEventUser([{ userId: null, role: "OWNER" }])).toBeNull()
    expect(resolveHouseholdEventUser([])).toBeNull()
  })
})
