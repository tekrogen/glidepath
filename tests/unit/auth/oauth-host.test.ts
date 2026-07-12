/** OAuth host-mismatch helper (issue #15). */
import { describe, expect, it } from "vitest"

import { oauthMismatchHost } from "@/lib/auth/messages"

describe("oauthMismatchHost", () => {
  it("null when hosts match (case-insensitive, with port)", () => {
    expect(oauthMismatchHost("localhost:6014", "https://localhost:6014")).toBeNull()
    expect(oauthMismatchHost("LOCALHOST:6014", "http://localhost:6014")).toBeNull()
  })
  it("returns the registered host on mismatch (the LAN case)", () => {
    expect(oauthMismatchHost("10.0.0.5:6014", "https://localhost:6014")).toBe("localhost:6014")
  })
  it("null on missing or malformed inputs — never blocks sign-in", () => {
    expect(oauthMismatchHost(null, "https://localhost:6014")).toBeNull()
    expect(oauthMismatchHost("localhost:6014", undefined)).toBeNull()
    expect(oauthMismatchHost("localhost:6014", "not a url")).toBeNull()
  })
})
