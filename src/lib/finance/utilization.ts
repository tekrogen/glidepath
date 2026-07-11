import type { Minor } from "./money"

/** Cards at or above this exact fraction are high-utilization (tracker rule). */
export const HIGH_UTILIZATION_THRESHOLD = 0.3

/**
 * Utilization as an exact fraction, or null when the limit is unknown or
 * non-positive. Display rounding happens at the UI layer only — a card at
 * 29.99% renders as "30.0%" but is NOT high-utilization.
 */
export function utilization(balanceMinor: Minor, limitMinor: Minor | null): number | null {
  if (limitMinor == null || limitMinor <= 0n) return null
  return Number(balanceMinor) / Number(limitMinor)
}

export function isHighUtilization(balanceMinor: Minor, limitMinor: Minor | null): boolean {
  const u = utilization(balanceMinor, limitMinor)
  return u != null && u >= HIGH_UTILIZATION_THRESHOLD
}
