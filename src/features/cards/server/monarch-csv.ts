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
/** Longest acceptable verbatim account string (the persisted match key). */
export const MAX_ACCOUNT_CHARS = 512

export interface CsvRecord {
  fields: string[]
  /** 1-based PHYSICAL line the record starts on — warnings must name the
   *  line a user can find in their file (review finding: a filtered-record
   *  index drifts past blank lines and quoted embedded newlines). */
  line: number
}

/**
 * RFC 4180-lite tokenizer: quoted fields may contain commas, doubled-quote
 * escapes, and embedded newlines. CRLF and LF both delimit records; a BOM
 * is stripped. The raw shape is shared so a future transactions parser
 * (the stretch goal) sits beside the balances one.
 */
export function parseCsv(text: string): CsvRecord[] {
  const src = text.replace(/^﻿/, "")
  const records: CsvRecord[] = []
  let fields: string[] = []
  let cur = ""
  let inQuotes = false
  let started = false
  let line = 1
  let recordLine = 1
  const endField = () => {
    fields.push(cur)
    cur = ""
    started = false
  }
  const endRecord = () => {
    endField()
    records.push({ fields, line: recordLine })
    fields = []
    recordLine = line
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
        if (ch === "\n") line++
        cur += ch
      }
    } else if (ch === '"' && !started && cur === "") {
      inQuotes = true
      started = true
    } else if (ch === ",") {
      endField()
    } else if (ch === "\n") {
      line++
      endRecord()
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") i++
      line++
      endRecord()
    } else {
      cur += ch
      started = true
    }
  }
  // Final record unless the file ended exactly on a record boundary.
  if (cur !== "" || fields.length > 0) endRecord()
  // A trailing newline produces one empty single-field record — drop those.
  return records.filter((r) => !(r.fields.length === 1 && r.fields[0].trim() === ""))
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
  const header = records[0].fields.map((h) => h.trim().toLowerCase())
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
    const { fields, line } = records[i]
    if (fields.length !== 3) {
      warn(`Line ${line}: expected 3 fields, got ${fields.length} — skipped.`)
      continue
    }
    const date = validDate(fields[dateCol])
    const balanceMinor = parseSignedDollarsToMinor(fields[balanceCol])
    const account = fields[accountCol].trim()
    if (!date || balanceMinor == null || account === "") {
      warn(`Line ${line}: unreadable date, balance, or account — skipped.`)
      continue
    }
    // The account string becomes the persisted match key — a pathological
    // length would exceed the Postgres btree index row limit at COMMIT
    // (aborting the whole import with a generic error); refuse it at parse
    // with a findable message instead (review finding). Real names ≤ 60.
    if (account.length > MAX_ACCOUNT_CHARS) {
      warn(`Line ${line}: account name longer than ${MAX_ACCOUNT_CHARS} characters — skipped.`)
      continue
    }
    const magnitude = balanceMinor < 0n ? -balanceMinor : balanceMinor
    if (magnitude > MAX_AMOUNT_MINOR) {
      warn(`Line ${line}: balance exceeds the app's maximum — skipped.`)
      continue
    }
    rows.push({ date, balanceMinor, account })
  }
  if (suppressed > 0) warnings.push(`…and ${suppressed} more.`)
  return { rows, warnings }
}
