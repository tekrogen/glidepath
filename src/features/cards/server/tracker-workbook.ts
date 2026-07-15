/**
 * Tracker workbook reader (Blueprint F16 / EDR-021).
 *
 * Buffer-based xlsx → TrackerRow[] extraction, shared by the CLI
 * (scripts/import-tracker.ts) and the upload UI (issue #28). The pure
 * row→card mapping lives in ./tracker-import; the Prisma writes live in
 * ./tracker-import-commit. Keeping the read here means the CLI and the
 * upload flow parse identically — the "Card Tracker" sheet, rows 6–25.
 */
import ExcelJS from "exceljs"

import type { TrackerRow } from "./tracker-import"

export const TRACKER_SHEET = "Card Tracker"
const FIRST_ROW = 6
const LAST_ROW = 25

function cellString(v: ExcelJS.CellValue): string | null {
  if (v == null) return null
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("")
  return String(v)
}
function cellNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v
  return null
}
function cellDate(v: ExcelJS.CellValue): Date | null {
  return v instanceof Date ? v : null
}

/** Raised when the uploaded workbook lacks the expected "Card Tracker" sheet. */
export class TrackerSheetMissingError extends Error {
  constructor() {
    super(`Sheet "${TRACKER_SHEET}" not found — is this the card tracker workbook?`)
    this.name = "TrackerSheetMissingError"
  }
}

/** Read the tracker rows from an in-memory xlsx (upload buffer or file bytes). */
export async function parseTrackerWorkbook(
  data: Buffer | ArrayBuffer
): Promise<TrackerRow[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data as ExcelJS.Buffer)
  const ws = wb.getWorksheet(TRACKER_SHEET)
  if (!ws) throw new TrackerSheetMissingError()

  const rows: TrackerRow[] = []
  for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
    const row = ws.getRow(r)
    // Columns: B name · C last4 · D issuer · F balance · G available ·
    // I 0%? · J 0% end · L APR · N due day · O payment text · R notes
    rows.push({
      cardName: cellString(row.getCell("B").value),
      lastFour: cellString(row.getCell("C").value),
      issuer: cellString(row.getCell("D").value),
      currentBalance: cellNumber(row.getCell("F").value),
      availableCredit: cellNumber(row.getCell("G").value),
      hasIntroApr: cellString(row.getCell("I").value),
      introAprEndDate: cellDate(row.getCell("J").value),
      regularApr: cellNumber(row.getCell("L").value),
      paymentDueDay: cellNumber(row.getCell("N").value),
      paymentText: cellString(row.getCell("O").value),
      notes: cellString(row.getCell("R").value),
    })
  }
  return rows
}
