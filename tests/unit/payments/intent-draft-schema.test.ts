/**
 * Stepper draft schema (issue #45, EDR-012): every field optional, every
 * present field valid. Money parsing delegates to lib/finance; dates are
 * round-trip-exact (no calendar rollover) and bounded to a year out.
 */
import { describe, expect, it } from "vitest"

import { intentDraftSchema, MAX_SCHEDULE_DAYS } from "@/features/payments/schemas/intent-draft-schema"

const TODAY = new Date("2026-07-21T00:00:00Z")
const schema = intentDraftSchema(TODAY)

const base = {
  intentId: "int-1",
  cardId: "card-1",
  amount: "350.00",
  scheduledFor: "2026-08-02",
  fundingAccountId: "",
  note: "  Statement Amt  ",
}

describe("intentDraftSchema", () => {
  it("parses a full draft: minor units, dates, trimmed note, ''→null ids", () => {
    const out = schema.parse(base)
    expect(out).toEqual({
      intentId: "int-1",
      cardId: "card-1",
      amount: 35000n,
      scheduledFor: new Date("2026-08-02T00:00:00Z"),
      fundingAccountId: null,
      note: "Statement Amt",
    })
  })

  it("allows an entirely empty draft (incompleteness is confirm's concern)", () => {
    const out = schema.parse({})
    expect(out).toEqual({
      intentId: null,
      cardId: null,
      amount: null,
      scheduledFor: null,
      fundingAccountId: null,
      note: null,
    })
  })

  it("amount: grouping commas ok; zero, junk, and over-max rejected", () => {
    expect(schema.parse({ ...base, amount: "1,234.56" }).amount).toBe(123456n)
    expect(schema.safeParse({ ...base, amount: "0" }).success).toBe(false)
    expect(schema.safeParse({ ...base, amount: "12.345" }).success).toBe(false)
    expect(schema.safeParse({ ...base, amount: "abc" }).success).toBe(false)
    expect(schema.safeParse({ ...base, amount: "100000000.00" }).success).toBe(false)
  })

  it("dates: today ok; past, rollover (2026-02-31), and beyond a year rejected", () => {
    expect(schema.parse({ ...base, scheduledFor: "2026-07-21" }).scheduledFor).toEqual(TODAY)
    expect(schema.safeParse({ ...base, scheduledFor: "2026-07-20" }).success).toBe(false)
    expect(schema.safeParse({ ...base, scheduledFor: "2027-02-31" }).success).toBe(false)
    // Exactly the bound is fine; one past it is not.
    const atBound = new Date(TODAY)
    atBound.setUTCDate(atBound.getUTCDate() + MAX_SCHEDULE_DAYS)
    expect(
      schema.safeParse({ ...base, scheduledFor: atBound.toISOString().slice(0, 10) }).success
    ).toBe(true)
    const pastBound = new Date(TODAY)
    pastBound.setUTCDate(pastBound.getUTCDate() + MAX_SCHEDULE_DAYS + 1)
    expect(
      schema.safeParse({ ...base, scheduledFor: pastBound.toISOString().slice(0, 10) }).success
    ).toBe(false)
  })

  it("note: 200 chars ok, 201 rejected, whitespace-only → null", () => {
    expect(schema.parse({ ...base, note: "x".repeat(200) }).note).toBe("x".repeat(200))
    expect(schema.safeParse({ ...base, note: "x".repeat(201) }).success).toBe(false)
    expect(schema.parse({ ...base, note: "   " }).note).toBeNull()
  })
})
