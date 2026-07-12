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

/**
 * Classify a utilization fraction for the Overview header chip. Keeps the
 * threshold rule in lib/finance (never a component): at/above the high
 * threshold is "high", a known fraction below is "ok", unknown limit is
 * "unknown". Display rounding still happens only at the UI layer.
 */
export function utilizationStatus(fraction: number | null): "ok" | "high" | "unknown" {
  if (fraction == null) return "unknown"
  return fraction >= HIGH_UTILIZATION_THRESHOLD ? "high" : "ok"
}
