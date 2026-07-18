import type { AprBps, Minor } from "./money"
import { roundHalfAwayDiv } from "./money"

/**
 * Estimated monthly interest: balance × APR ÷ 12 (EDR-020).
 *
 * This is the tracker's own simple estimate — NOT the issuer's
 * average-daily-balance method. Every UI figure derived from it must render
 * with the "~" estimated prefix.
 *
 * Returns null when the APR is unknown or the balance is non-positive,
 * and 0 while a promo shelters the balance.
 */
export function estMonthlyInterestMinor(
  balanceMinor: Minor,
  aprBps: AprBps | null,
  promoActive: boolean
): Minor | null {
  if (aprBps == null || balanceMinor <= 0n) return null
  if (promoActive) return 0n
  // balance × (bps/10_000) ÷ 12  ==  balance × bps ÷ 120_000
  return roundHalfAwayDiv(balanceMinor * BigInt(aprBps), 120_000n)
}

/**
 * ~Interest delta of moving a payment by `deltaDays` (positive = later,
 * negative = earlier) — the runway drag/keyboard reschedule preview (F6).
 *
 * Same simple-estimate basis as estMonthlyInterestMinor, prorated per day:
 * monthly ÷ DAYS_PER_MONTH (30.4375 = 487/16), so
 * balance × bps × days × 16 ÷ (120_000 × 487). EDR-020: renders with "~".
 *
 * Returns null when the APR is unknown or the balance is non-positive,
 * and 0 while a promo shelters the balance.
 */
export function rescheduleInterestDeltaMinor(
  balanceMinor: Minor,
  aprBps: AprBps | null,
  promoActive: boolean,
  deltaDays: number
): Minor | null {
  if (aprBps == null || balanceMinor <= 0n) return null
  if (promoActive) return 0n
  const days = BigInt(Math.trunc(Math.abs(deltaDays)))
  const magnitude = roundHalfAwayDiv(balanceMinor * BigInt(aprBps) * days * 16n, 120_000n * 487n)
  return deltaDays < 0 ? -magnitude : magnitude
}
