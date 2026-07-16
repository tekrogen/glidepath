/**
 * Tracker workbook reader conformance (Blueprint F16 / issue #28).
 *
 * Builds xlsx workbooks in memory with exceljs — the same library the
 * reader uses — so CI exercises the real buffer → TrackerRow[] path
 * (sheet lookup, the 6–25 read window, per-column coercion) without
 * touching the local-only tracker file.
 */
import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

import type { TrackerRow } from "@/features/cards/server/tracker-import"
import {
  parseTrackerWorkbook,
  TRACKER_SHEET,
  TrackerSheetMissingError,
} from "@/features/cards/server/tracker-workbook"

const blankRow: TrackerRow = {
  cardName: null,
  lastFour: null,
  issuer: null,
  currentBalance: null,
  availableCredit: null,
  hasIntroApr: null,
  introAprEndDate: null,
  regularApr: null,
  paymentDueDay: null,
  paymentText: null,
  notes: null,
}

const toBuffer = async (wb: ExcelJS.Workbook): Promise<Buffer> =>
  Buffer.from(await wb.xlsx.writeBuffer())

describe("parseTrackerWorkbook", () => {
  it("round-trips the tracker columns (B/C/D/F/G/I/J/L/N/O/R) from rows 6–25", async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(TRACKER_SHEET)

    const r6 = ws.getRow(6)
    r6.getCell("B").value = "Quicksilver (Marti)"
    r6.getCell("C").value = "8391"
    r6.getCell("D").value = "Capital One"
    r6.getCell("F").value = 732.24
    r6.getCell("G").value = 9017.26
    r6.getCell("I").value = "No"
    r6.getCell("L").value = 0.134
    r6.getCell("N").value = 19
    r6.getCell("O").value = "Statement Amt"
    r6.getCell("R").value = "Autopay on"

    // Promo row with a Date end and a richText name (as pasted cells arrive).
    const promoEnd = new Date(Date.UTC(2026, 9, 1))
    const r7 = ws.getRow(7)
    r7.getCell("B").value = { richText: [{ text: "Rate Advantage " }, { text: "(Marti)" }] }
    r7.getCell("C").value = "9463"
    r7.getCell("I").value = "Yes"
    r7.getCell("J").value = promoEnd

    const rows = await parseTrackerWorkbook(await toBuffer(wb))
    expect(rows).toHaveLength(20) // rows 6..25 inclusive, blanks included

    expect(rows[0]).toEqual({
      cardName: "Quicksilver (Marti)",
      lastFour: "8391",
      issuer: "Capital One",
      currentBalance: 732.24,
      availableCredit: 9017.26,
      hasIntroApr: "No",
      introAprEndDate: null,
      regularApr: 0.134,
      paymentDueDay: 19,
      paymentText: "Statement Amt",
      notes: "Autopay on",
    })

    expect(rows[1].cardName).toBe("Rate Advantage (Marti)") // richText joined
    expect(rows[1].introAprEndDate).toEqual(promoEnd)
    expect(rows[1].hasIntroApr).toBe("Yes")
  })

  it("ignores rows outside 6–25; blank rows inside come back all-null", async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(TRACKER_SHEET)
    ws.getRow(5).getCell("B").value = "Header row — must not leak in"
    ws.getRow(26).getCell("B").value = "Totals row — must not leak in"
    ws.getRow(10).getCell("B").value = "Only real card"

    const rows = await parseTrackerWorkbook(await toBuffer(wb))
    expect(rows).toHaveLength(20)
    expect(rows[4]).toEqual({ ...blankRow, cardName: "Only real card" }) // row 10
    rows.forEach((r, i) => {
      if (i !== 4) expect(r).toEqual(blankRow)
    })
  })

  it("throws TrackerSheetMissingError when the Card Tracker sheet is absent", async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet("Sheet1")
    const buf = await toBuffer(wb)

    await expect(parseTrackerWorkbook(buf)).rejects.toBeInstanceOf(TrackerSheetMissingError)
    await expect(parseTrackerWorkbook(buf)).rejects.toThrow(/Card Tracker/)
  })

  it("rejects on a buffer that is not an xlsx", async () => {
    await expect(parseTrackerWorkbook(Buffer.from("not an xlsx"))).rejects.toThrow()
  })
})
