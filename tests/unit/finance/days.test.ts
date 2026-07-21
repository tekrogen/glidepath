/**
 * Day helpers (issue #44 review fix): addUtcDays is the ONE owner of
 * "date + n days" — the runway commit path persists its output, so
 * month/year boundaries are pinned here.
 */
import { describe, expect, it } from "vitest"

import { addUtcDays } from "@/lib/finance"

const utc = (s: string) => new Date(`${s}T00:00:00Z`)

describe("addUtcDays", () => {
  it("crosses month boundaries in UTC date-only space", () => {
    expect(addUtcDays(utc("2026-07-25"), 10)).toEqual(utc("2026-08-04"))
    expect(addUtcDays(utc("2026-01-31"), 1)).toEqual(utc("2026-02-01"))
  })

  it("crosses year boundaries", () => {
    expect(addUtcDays(utc("2026-12-30"), 5)).toEqual(utc("2027-01-04"))
  })

  it("accepts negative offsets and zero", () => {
    expect(addUtcDays(utc("2026-03-01"), -1)).toEqual(utc("2026-02-28"))
    expect(addUtcDays(utc("2026-07-19"), 0)).toEqual(utc("2026-07-19"))
  })
})
