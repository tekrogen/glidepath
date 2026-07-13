/**
 * Sparse-data display decisions for the Overview metric grid (issue #29).
 *
 * Pure presentation helpers — no math, only the copy/format branch a sparse
 * (one-card / limit-less / no-accrual) portfolio needs so the grid never
 * renders a negative "Available Credit", "across 0 cards", or a zeroed
 * `~$0.00` estimate (EDR-020: the "~" marker is for real estimates only).
 */
import { formatMinor } from "@/lib/formatting"
import type { PortfolioSummary } from "@/lib/finance"

/**
 * Available credit: "—" (unknown) when no card has a known limit — otherwise
 * `totalLimit - balance` is `0 - balance`, a misleading negative dollar figure.
 */
export function availableCreditDisplay(summary: PortfolioSummary): string {
  return summary.totalLimitMinor === 0n ? "—" : formatMinor(summary.availableCreditMinor)
}

/** The sheltered subtitle — natural copy, never "across 0 cards". */
export function shelteredSubtitle(summary: PortfolioSummary): string {
  if (summary.shelteredCardCount === 0) {
    return "No balances sheltered at 0% APR"
  }
  const cardWord = summary.shelteredCardCount === 1 ? "card" : "cards"
  return `${formatMinor(summary.shelteredMinor)} of balance sheltered at 0% APR across ${summary.shelteredCardCount} ${cardWord}`
}

/**
 * Whether to render the "+ ~$X/mo est. interest" suffix — only for a real
 * non-zero estimate. `~$0.00` would violate EDR-020, so the suffix is dropped
 * when no balance is accruing interest.
 */
export function hasEstimatedInterest(summary: PortfolioSummary): boolean {
  return summary.estMonthlyInterestMinor !== 0n
}
