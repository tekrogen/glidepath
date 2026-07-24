/**
 * Intent rules (issue #45 exit criterion: "intent expiry covered by unit
 * tests"). TTL, the timestamp-exact expiry boundary, and the confirm
 * completeness gate — the pure rules the service applies; EXPIRED status
 * flips arrive with the #46 cron.
 */
import { describe, expect, it } from "vitest"

import { MAX_AMOUNT_MINOR } from "@/lib/finance"
import {
  INTENT_TTL_HOURS,
  intentExpiresAt,
  isIntentExpired,
  validateIntentComplete,
} from "@/features/payments/utils/intent"

const NOW = new Date("2026-07-21T15:30:00Z")
const utc = (s: string) => new Date(`${s}T00:00:00Z`)

describe("intentExpiresAt / isIntentExpired", () => {
  it("arms exactly TTL hours ahead", () => {
    expect(INTENT_TTL_HOURS).toBe(24)
    expect(intentExpiresAt(NOW)).toEqual(new Date("2026-07-22T15:30:00Z"))
  })

  it("expiry is timestamp-exact: dead AT expiresAt, alive 1ms before", () => {
    const expiresAt = intentExpiresAt(NOW)
    expect(isIntentExpired(expiresAt, expiresAt)).toBe(true)
    expect(isIntentExpired(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(false)
    expect(isIntentExpired(expiresAt, new Date(expiresAt.getTime() + 1))).toBe(true)
  })
})

describe("validateIntentComplete", () => {
  const complete = {
    cardId: "card-1",
    amountMinor: 35000n,
    scheduledFor: utc("2026-08-02"),
  }

  it("accepts a complete intent, including one scheduled for today", () => {
    expect(validateIntentComplete(complete, NOW)).toEqual({ ok: true })
    expect(
      validateIntentComplete({ ...complete, scheduledFor: utc("2026-07-21") }, NOW)
    ).toEqual({ ok: true })
  })

  it("names the missing field, checked in step order", () => {
    expect(validateIntentComplete({ ...complete, cardId: null }, NOW)).toMatchObject({
      ok: false,
      message: expect.stringContaining("card"),
    })
    expect(validateIntentComplete({ ...complete, amountMinor: null }, NOW)).toMatchObject({
      ok: false,
      message: expect.stringContaining("amount"),
    })
    expect(validateIntentComplete({ ...complete, scheduledFor: null }, NOW)).toMatchObject({
      ok: false,
      message: expect.stringContaining("date"),
    })
  })

  it("re-checks amount bounds server-side", () => {
    expect(validateIntentComplete({ ...complete, amountMinor: 0n }, NOW).ok).toBe(false)
    expect(validateIntentComplete({ ...complete, amountMinor: -100n }, NOW).ok).toBe(false)
    expect(
      validateIntentComplete({ ...complete, amountMinor: MAX_AMOUNT_MINOR + 1n }, NOW).ok
    ).toBe(false)
    expect(
      validateIntentComplete({ ...complete, amountMinor: MAX_AMOUNT_MINOR }, NOW).ok
    ).toBe(true)
  })

  it("rejects a date that has passed (UTC date-only compare)", () => {
    expect(
      validateIntentComplete({ ...complete, scheduledFor: utc("2026-07-20") }, NOW).ok
    ).toBe(false)
  })
})
