/**
 * Money primitives (Blueprint EDR-008 / EDR-019).
 *
 * All arithmetic runs in integer minor units (bigint cents) with APRs as
 * integer basis points (2274 = 22.74%). Never sum across currencies without
 * an explicit conversion step.
 */

/** Integer minor units (e.g. cents). */
export type Minor = bigint

/** APR in basis points: 2274 = 22.74%. */
export type AprBps = number

/**
 * Divide, rounding half away from zero. Inputs must be non-negative
 * (all Glidepath money math operates on magnitudes).
 */
export function roundHalfAwayDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("denominator must be positive")
  if (numerator < 0n) throw new RangeError("numerator must be non-negative")
  return (2n * numerator + denominator) / (2n * denominator)
}

/** Divide, rounding up. Used where a plan must never undershoot. */
export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("denominator must be positive")
  if (numerator < 0n) throw new RangeError("numerator must be non-negative")
  return (numerator + denominator - 1n) / denominator
}

export function maxMinor(a: Minor, b: Minor): Minor {
  return a > b ? a : b
}

/** Largest amount the app accepts from user input: $99,999,999.99. */
export const MAX_AMOUNT_MINOR: Minor = 9_999_999_999n

/**
 * Parse a user-typed dollar amount ("9750.00", "1,234.56") into minor units.
 * Grouping commas must be well-formed thousands groups — "1,2,3" and
 * locale-style "1.234,56" are rejected, never reinterpreted. At most two
 * decimals are accepted (never rounded — "12.345" is rejected, not
 * guessed). Returns null for anything else, including the empty string and
 * negative amounts. Range bounds (MAX_AMOUNT_MINOR) are the caller's job —
 * the schema rejects them with a user-facing message.
 */
export function parseDollarsToMinor(input: string): Minor | null {
  const t = input.trim()
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(t) && !/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [whole, frac = ""] = t.replace(/,/g, "").split(".")
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0") || "0")
}

/**
 * Parse a user-typed percentage ("22.74") into basis points (2274).
 * At most two decimals; the sane APR window is 0–99.99% (0–9999 bps) —
 * anything outside returns null, as does the empty string.
 */
export function percentToBps(input: string): AprBps | null {
  const t = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [whole, frac = ""] = t.split(".")
  const bps = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0")
  return bps > 9999 ? null : bps
}
