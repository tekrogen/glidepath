/**
 * Tracker-import row mapper (Blueprint F16 / EDR-021).
 *
 * Pure functions only — the xlsx reading and Prisma writes live in
 * scripts/import-tracker.ts. Every ambiguity becomes a warning in the
 * import report; nothing is guessed silently (Gap G14).
 *
 * Column semantics come from the origin tracker (Card Tracker sheet,
 * rows 6–25): the user enters balance and available credit, so the
 * credit limit is COMPUTED as balance + available — exactly what the
 * spreadsheet's own formula does.
 */

/** Raw literal cell values for one tracker row (formula cells excluded by design). */
export interface TrackerRow {
  cardName: string | null
  lastFour: string | number | null
  issuer: string | null
  /** F — current balance, dollars. */
  currentBalance: number | null
  /** G — available credit, dollars. */
  availableCredit: number | null
  /** I — "Yes" / "No". */
  hasIntroApr: string | null
  /** J — 0% end date. */
  introAprEndDate: Date | null
  /** L — regular APR as a fraction (0.1924 = 19.24%). */
  regularApr: number | null
  /** N — payment due day of month. */
  paymentDueDay: number | null
  /** O — free-text planned payment ("$350/month", "Statement Amt"). */
  paymentText: string | null
  /** R — notes. */
  notes: string | null
}

export interface ParsedTrackerCard {
  cardName: string
  /** "Marti", "Bob", … — null means shared. */
  ownerLabel: string | null
  lastFour: string | null
  issuer: string
  issuerKey: string | null
  creditLimitMinor: bigint | null
  currentBalanceMinor: bigint
  /** Card-level APR; null while an active promo carries the post-promo APR. */
  regularAprBps: number | null
  paymentDueDay: number | null
  minimumPaymentMinor: bigint | null
  paymentNote: string | null
  notes: string | null
  promo: { endsOn: Date; regularAprBpsAfter: number | null } | null
  warnings: string[]
}

const ISSUER_KEYS: Array<[RegExp, string]> = [
  [/chase/i, "chase"],
  [/cit(i|y)bank|citi\b/i, "citi"],
  [/us ?bank/i, "usbank"],
  [/usaa/i, "usaa"],
  [/capital ?one/i, "capitalone"],
  [/wells ?fargo/i, "wellsfargo"],
  [/apple/i, "apple"],
  [/^ally$/i, "ally"],
]

export function toMinor(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100))
}

export function aprFractionToBps(fraction: number): number {
  return Math.round(fraction * 10_000)
}

/** "Quicksilver (Marti)" → { name: "Quicksilver", owner: "Marti" }; "(Shared)" → owner null. */
export function splitOwner(raw: string): { name: string; owner: string | null } {
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (!m) return { name: raw.trim(), owner: null }
  const owner = m[2].trim()
  return {
    name: m[1].trim(),
    owner: /^shared$/i.test(owner) ? null : owner,
  }
}

/** "$350/month" → 35000n; "Statement Amt" → null (note only). */
export function parseMinimumFromText(text: string): bigint | null {
  const m = text.trim().match(/^\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/\s*(?:month|mo))?$/i)
  if (!m) return null
  return toMinor(Number(m[1].replace(/,/g, "")))
}

export function normalizeLastFour(value: string | number | null): {
  lastFour: string | null
  warning: string | null
} {
  if (value == null || value === "") return { lastFour: null, warning: "no last-four recorded" }
  const s = String(value).trim()
  if (/^x+$/i.test(s)) return { lastFour: null, warning: `last-four placeholder "${s}" treated as unknown` }
  if (/^\d{1,4}$/.test(s)) return { lastFour: s.padStart(4, "0"), warning: null }
  return { lastFour: null, warning: `unrecognized last-four "${s}" treated as unknown` }
}

export function issuerKeyFor(issuer: string): string | null {
  for (const [re, key] of ISSUER_KEYS) if (re.test(issuer)) return key
  return null
}

/** Map one raw tracker row to a card, or null when the row is blank. */
export function parseTrackerRow(row: TrackerRow): ParsedTrackerCard | null {
  if (!row.cardName || !row.cardName.trim()) return null
  const warnings: string[] = []

  const { name, owner } = splitOwner(row.cardName)
  const { lastFour, warning: lastFourWarning } = normalizeLastFour(row.lastFour)
  if (lastFourWarning) warnings.push(lastFourWarning)

  const issuer = (row.issuer ?? "").trim() || "Unknown"
  if (issuer === "Unknown") warnings.push("no issuer recorded")
  const issuerKey = issuerKeyFor(issuer)
  if (!issuerKey && issuer !== "Unknown") {
    warnings.push(`issuer "${issuer}" has no known key — swatch falls back to neutral`)
  }

  const balanceMinor = row.currentBalance != null ? toMinor(row.currentBalance) : 0n
  const limitMinor =
    row.currentBalance != null && row.availableCredit != null
      ? toMinor(row.currentBalance) + toMinor(row.availableCredit)
      : null
  if (limitMinor == null) warnings.push("credit limit unknown (needs balance AND available credit)")

  const aprBps = row.regularApr != null ? aprFractionToBps(row.regularApr) : null
  if (aprBps == null && balanceMinor > 0n) {
    warnings.push("APR unknown with a live balance — interest estimates unavailable")
  }
  if (row.paymentDueDay == null && balanceMinor > 0n) {
    warnings.push("payment due day unknown — card sits in the runway's unscheduled gutter")
  }

  const claimsPromo = /^yes$/i.test((row.hasIntroApr ?? "").trim())
  let promo: ParsedTrackerCard["promo"] = null
  if (claimsPromo && row.introAprEndDate != null) {
    promo = { endsOn: row.introAprEndDate, regularAprBpsAfter: aprBps }
  } else if (claimsPromo) {
    warnings.push("0% promo claimed but no end date — record it in the app to enable payoff planning")
  }

  let minimumPaymentMinor: bigint | null = null
  let paymentNote: string | null = null
  if (row.paymentText && row.paymentText.trim()) {
    paymentNote = row.paymentText.trim()
    minimumPaymentMinor = parseMinimumFromText(paymentNote)
    if (minimumPaymentMinor == null) {
      warnings.push(`payment note "${paymentNote}" kept as text — no fixed minimum parsed`)
    }
  }

  return {
    cardName: name,
    ownerLabel: owner,
    lastFour,
    issuer,
    issuerKey,
    creditLimitMinor: limitMinor,
    currentBalanceMinor: balanceMinor,
    // While a promo is active the card-level APR is null; the post-promo
    // rate lives on the PromoPeriod (schema convention, Level 6).
    regularAprBps: promo ? null : aprBps,
    paymentDueDay: row.paymentDueDay,
    minimumPaymentMinor,
    paymentNote,
    notes: row.notes?.trim() || null,
    promo,
    warnings,
  }
}
