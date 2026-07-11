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
