/**
 * Monarch CSV parsing (issue #48): header-by-name, RFC4180 quoting incl.
 * embedded newlines, BOM/CRLF, string-based signed money via lib/finance,
 * round-trip dates, never-guess row skips, warning cap.
 */
import { describe, expect, it } from "vitest"

import {
  MonarchCsvFormatError,
  parseCsv,
  parseMonarchBalancesCsv,
} from "@/features/cards/server/monarch-csv"
import { parseSignedDollarsToMinor } from "@/lib/finance"

describe("parseSignedDollarsToMinor", () => {
  it("signed machine amounts, string-split, never reinterpreted", () => {
    expect(parseSignedDollarsToMinor("-1,511.38")).toBe(-151138n)
    expect(parseSignedDollarsToMinor("-578.86")).toBe(-57886n)
    expect(parseSignedDollarsToMinor("0")).toBe(0n)
    expect(parseSignedDollarsToMinor("12.5")).toBe(1250n)
    expect(parseSignedDollarsToMinor("663691.80")).toBe(66369180n)
    expect(parseSignedDollarsToMinor("19.99")).toBe(1999n) // float trap: 19.99*100 = 1998.9999…
    expect(parseSignedDollarsToMinor("1.234")).toBeNull()
    expect(parseSignedDollarsToMinor("$5")).toBeNull()
    expect(parseSignedDollarsToMinor("1,2,3")).toBeNull()
    expect(parseSignedDollarsToMinor("--5")).toBeNull()
    expect(parseSignedDollarsToMinor("")).toBeNull()
  })
})

describe("parseCsv", () => {
  it("quoted commas, doubled-quote escapes, embedded newlines, CRLF+LF — with physical line numbers", () => {
    const records = parseCsv('a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\nlast,row,here\n')
    expect(records).toEqual([
      { fields: ["a", "b", "c"], line: 1 },
      { fields: ["x, y", 'he said "hi"', "line1\nline2"], line: 2 },
      // The quoted field consumed a physical newline — "last" starts on 4.
      { fields: ["last", "row", "here"], line: 4 },
    ])
  })
})

describe("parseMonarchBalancesCsv", () => {
  const CSV = [
    "Date,Balance,Account",
    "2026-07-16,-3883.27,USAA Rate Advantage Platinum Visa (...9463)",
    "2026-07-17,-3893.02,USAA Rate Advantage Platinum Visa (...9463)",
    "2026-07-17,-3166.28,My Best Buy® Visa® Card (...7727)",
    '2026-07-17,-42.00,"Card, With Comma (...0042)"',
    "2026-07-17,1755.39,USAA CLASSIC CHECKING (...2203)",
  ].join("\r\n")

  it("parses BOM + CRLF + quoting + ® verbatim", () => {
    const { rows, warnings } = parseMonarchBalancesCsv("﻿" + CSV)
    expect(warnings).toEqual([])
    expect(rows).toHaveLength(5)
    expect(rows[2].account).toBe("My Best Buy® Visa® Card (...7727)")
    expect(rows[3].account).toBe("Card, With Comma (...0042)")
    expect(rows[3].balanceMinor).toBe(-4200n)
  })

  it("locates the header by name, case-insensitive and order-independent", () => {
    const { rows } = parseMonarchBalancesCsv(
      "account,DATE,Balance\nX (...1111),2026-07-17,-5.00"
    )
    expect(rows).toEqual([{ account: "X (...1111)", date: "2026-07-17", balanceMinor: -500n }])
  })

  it("rejects a non-Monarch header with the friendly error", () => {
    expect(() => parseMonarchBalancesCsv("Name,Amount,Foo\nx,1,2")).toThrow(MonarchCsvFormatError)
    expect(() => parseMonarchBalancesCsv("")).toThrow(MonarchCsvFormatError)
  })

  it("skips malformed rows with warnings — rolled dates, bad money, over-max", () => {
    const { rows, warnings } = parseMonarchBalancesCsv(
      [
        "Date,Balance,Account",
        "2026-02-31,-1.00,Ghost (...1111)", // rolled date
        "2026-07-17,abc,Bad (...2222)", // bad money
        "2026-07-17,-999999999.00,Huge (...3333)", // over MAX_AMOUNT_MINOR
        "2026-07-17,-5.00,Good (...4444)",
      ].join("\n")
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].account).toBe("Good (...4444)")
    expect(warnings).toHaveLength(3)
  })

  it("warnings name PHYSICAL lines — blank lines don't shift them", () => {
    const { rows, warnings } = parseMonarchBalancesCsv(
      "Date,Balance,Account\n\n\n2026-07-17,junk,Bad (...1111)\n2026-07-17,-5.00,Good (...2222)"
    )
    expect(rows).toHaveLength(1)
    expect(warnings[0]).toContain("Line 4") // physical line, not record index
  })

  it("refuses pathologically long account names (the persisted-key/index bound)", () => {
    const long = "X".repeat(600) + " (...1234)"
    const { rows, warnings } = parseMonarchBalancesCsv(
      `Date,Balance,Account\n2026-07-17,-5.00,${long}\n2026-07-17,-6.00,Ok (...5678)`
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].account).toBe("Ok (...5678)")
    expect(warnings[0]).toContain("longer than")
  })

  it("caps warnings at 20 with an '…and N more' tail", () => {
    const bad = Array.from({ length: 25 }, (_, i) => `2026-07-17,junk,B${i} (...0001)`)
    const { warnings } = parseMonarchBalancesCsv(["Date,Balance,Account", ...bad].join("\n"))
    expect(warnings).toHaveLength(21)
    expect(warnings[20]).toBe("…and 5 more.")
  })
})
