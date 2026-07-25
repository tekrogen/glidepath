/**
 * Monarch balances CSV parsing (issue #48) — the only CSV-specific module,
 * mirroring tracker-workbook.ts's role for xlsx. No I/O, no Prisma: text
 * in → dated balance rows out. Matching and commit semantics live in
 * monarch-import.ts / monarch-import-commit.ts.
 *
 * Format (verified against the real export): columns {Date, Balance,
 * Account} located by NAME (case-insensitive, order-independent), ISO
 * dates, plain `-?d+.dd` balances — cards are NEGATIVE in Monarch's sign
 * convention, not this app's "positive owed". Account strings are kept
 * verbatim (® and all): the full string is the export's only unique key.
 * Money parses through lib/finance's string-split parser — never a float
 * (EDR-008/EDR-019). Malformed rows are skipped with a warning, never
 * guessed at; warnings cap at 20 so a pathological file can't flood the
 * preview.
 */
import { MAX_AMOUNT_MINOR, parseSignedDollarsToMinor } from "@/lib/finance"

export class MonarchCsvFormatError extends Error {
  constructor() {
    super(
      "That file doesn't look like a Monarch balances export — expected columns Date, Balance, Account."
    )
  }
}

export interface MonarchBalanceRow {
  /** yyyy-mm-dd, round-trip validated. */
  date: string
  /** Signed minor units exactly as exported (cards are negative in Monarch). */
  balanceMinor: bigint
  /** The verbatim account string — the ONLY unique per-file key. */
  account: string
}

const WARNING_CAP = 20

/**
 * RFC 4180-lite tokenizer: quoted fields may contain commas, doubled-quote
 * escapes, and embedded newlines. CRLF and LF both delimit records; a BOM
 * is stripped. The raw shape is shared so a future transactions parser
 * (the stretch goal) sits beside the balances one.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const records: string[][] = []
  let fields: string[] = []
  let cur = ""
  let inQuotes = false
  let started = false
  const endField = () => {
    fields.push(cur)
    cur = ""
    started = false
  }
  const endRecord = () => {
    endField()
    records.push(fields)
    fields = []
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"' && !started && cur === "") {
      inQuotes = true
      started = true
    } else if (ch === ",") {
      endField()
    } else if (ch === "\n") {
      endRecord()
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") i++
      endRecord()
    } else {
      cur += ch
      started = true
    }
  }
  // Final record unless the file ended exactly on a record boundary.
  if (cur !== "" || fields.length > 0) endRecord()
  // A trailing newline produces one empty single-field record — drop those.
  return records.filter((r) => !(r.length === 1 && r[0].trim() === ""))
}

/** yyyy-mm-dd, round-trip validated (2026-02-31 is rejected, never rolled). */
function validDate(text: string): string | null {
  const t = text.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) return null
  return t
}

export function parseMonarchBalancesCsv(text: string): {
  rows: MonarchBalanceRow[]
  warnings: string[]
} {
  const records = parseCsv(text)
  if (records.length === 0) throw new MonarchCsvFormatError()

  // Header located by name — case-insensitive, order-independent.
  const header = records[0].map((h) => h.trim().toLowerCase())
  const dateCol = header.indexOf("date")
  const balanceCol = header.indexOf("balance")
  const accountCol = header.indexOf("account")
  if (dateCol === -1 || balanceCol === -1 || accountCol === -1 || header.length !== 3) {
    throw new MonarchCsvFormatError()
  }

  const rows: MonarchBalanceRow[] = []
  const warnings: string[] = []
  let suppressed = 0
  const warn = (message: string) => {
    if (warnings.length < WARNING_CAP) warnings.push(message)
    else suppressed++
  }

  for (let i = 1; i < records.length; i++) {
    const record = records[i]
    if (record.length !== 3) {
      warn(`Line ${i + 1}: expected 3 fields, got ${record.length} — skipped.`)
      continue
    }
    const date = validDate(record[dateCol])
    const balanceMinor = parseSignedDollarsToMinor(record[balanceCol])
    const account = record[accountCol].trim()
    if (!date || balanceMinor == null || account === "") {
      warn(`Line ${i + 1}: unreadable date, balance, or account — skipped.`)
      continue
    }
    const magnitude = balanceMinor < 0n ? -balanceMinor : balanceMinor
    if (magnitude > MAX_AMOUNT_MINOR) {
      warn(`Line ${i + 1}: balance exceeds the app's maximum — skipped.`)
      continue
    }
    rows.push({ date, balanceMinor, account })
  }
  if (suppressed > 0) warnings.push(`…and ${suppressed} more.`)
  return { rows, warnings }
}
