/**
 * Display formatting — the ONLY place minor units become strings
 * (Blueprint Level 2 rounding policy: arithmetic in lib/finance,
 * formatting here, nothing in between).
 */

/** $43,969.72 from 4396972n (or a plain cents number from a client DTO). */
export function formatMinor(minor: bigint | number): string {
  const cents = typeof minor === "bigint" ? Number(minor) : minor
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

/** "20.4%" from 0.2037… — display rounding only, never for thresholds. */
export function formatPercent(fraction: number | null, digits = 1): string {
  if (fraction == null) return "—"
  return `${(fraction * 100).toFixed(digits)}%`
}

/** "22.74%" from 2274 bps. */
export function formatAprBps(bps: number | null): string {
  if (bps == null) return "—"
  return `${(bps / 100).toFixed(2)}%`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Sep 5 '27" (UTC date-only). */
export function formatShortDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} '${String(d.getUTCFullYear()).slice(2)}`
}

/** "JUL 11 2026" for the header stamp. */
export function formatStampDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()} ${d.getUTCFullYear()}`
}
