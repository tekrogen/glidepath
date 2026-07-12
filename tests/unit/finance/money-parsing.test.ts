/**
 * Pure money-parsing conversions (issue #26): user-typed dollars → minor
 * units and percent → basis points. Ambiguity is rejected, never rounded.
 */
import { describe, expect, it } from "vitest"

import { parseDollarsToMinor, percentToBps } from "@/lib/finance"

describe("parseDollarsToMinor", () => {
  it("parses whole and two-decimal amounts", () => {
    expect(parseDollarsToMinor("9750.00")).toBe(975000n)
    expect(parseDollarsToMinor("9750")).toBe(975000n)
    expect(parseDollarsToMinor("0")).toBe(0n)
    expect(parseDollarsToMinor("0.5")).toBe(50n)
    expect(parseDollarsToMinor("68.07")).toBe(6807n)
  })

  it("accepts well-formed thousands grouping", () => {
    expect(parseDollarsToMinor("1,234.56")).toBe(123456n)
    expect(parseDollarsToMinor("215,850")).toBe(21585000n)
    expect(parseDollarsToMinor("1,234,567.89")).toBe(123456789n)
  })

  it("trims surrounding whitespace", () => {
    expect(parseDollarsToMinor(" 12.34 ")).toBe(1234n)
  })

  it("rejects malformed grouping and locale-style separators", () => {
    expect(parseDollarsToMinor("1,2,3")).toBeNull() // bad grouping
    expect(parseDollarsToMinor("1.234,56")).toBeNull() // European locale
    expect(parseDollarsToMinor("12,34")).toBeNull() // not a thousands group
  })

  it("rejects empty, negative, non-numeric, and >2-decimal input", () => {
    expect(parseDollarsToMinor("")).toBeNull()
    expect(parseDollarsToMinor("-5")).toBeNull()
    expect(parseDollarsToMinor("abc")).toBeNull()
    expect(parseDollarsToMinor("12.345")).toBeNull() // never rounded — rejected
    expect(parseDollarsToMinor("$12")).toBeNull()
    expect(parseDollarsToMinor(".50")).toBeNull()
    expect(parseDollarsToMinor("12.")).toBeNull()
  })

  it("parses large values — the range cap is the schema's job, not the parser's", () => {
    expect(parseDollarsToMinor("100000000")).toBe(10000000000n) // $100M — parser accepts
    expect(parseDollarsToMinor("99999999.99")).toBe(9999999999n) // MAX_AMOUNT_MINOR
  })
})

describe("percentToBps", () => {
  it("parses percentages into basis points", () => {
    expect(percentToBps("22.74")).toBe(2274)
    expect(percentToBps("0")).toBe(0)
    expect(percentToBps("19.2")).toBe(1920)
    expect(percentToBps("99.99")).toBe(9999)
  })

  it("rejects empty, out-of-window, and malformed input", () => {
    expect(percentToBps("")).toBeNull()
    expect(percentToBps("100")).toBeNull() // window is 0–99.99%
    expect(percentToBps("-1")).toBeNull()
    expect(percentToBps("22.745")).toBeNull()
    expect(percentToBps("abc")).toBeNull()
  })
})
