/**
 * The canonical card-status engine (Blueprint EDR-003 — locked).
 *
 * Three orthogonal axes feed every surface (rack chip, table badge, runway
 * lane, matrix column, attention feed) from this one module. A second
 * alert-derivation path anywhere is a review-blocking defect.
 */
import { daysUntil, isHighUtilization } from "@/lib/finance"
import type { FinanceCard } from "@/lib/finance"

/** User-controlled, mutually exclusive. */
export type Lifecycle = "ACTIVE" | "FROZEN" | "ARCHIVED"

/** Aggregator linkage health — never shown as the status badge. */
export type ConnectionState =
  | "MANUAL"
  | "SYNCED"
  | "SYNC_PENDING"
  | "SYNC_FAILED"
  | "DISCONNECTED"

/** Derived alerts, highest priority first (thresholds are the tracker's). */
export type Alert =
  | "PROMO_EXPIRED"
  | "PROMO_ENDING_SOON"
  | "HIGH_UTILIZATION"
  | "DUE_SOON"
  | "OK"

export const PROMO_ENDING_SOON_DAYS = 60
export const DUE_SOON_DAYS = 7

export interface AlertInput extends FinanceCard {
  /** Days until the next payment due date; null when no due day is known. */
  dueInDays: number | null
  /** True when autopay or a scheduled payment already covers the due date. */
  dueCovered: boolean
}

/** The single highest-priority alert for a card. */
export function resolveAlert(card: AlertInput, today: Date): Alert {
  if (card.promo != null && card.promo.shelteredBalanceMinor > 0n) {
    const days = daysUntil(card.promo.endsOn, today)
    if (days < 0) return "PROMO_EXPIRED"
    if (days <= PROMO_ENDING_SOON_DAYS) return "PROMO_ENDING_SOON"
  }
  if (isHighUtilization(card.balanceMinor, card.limitMinor)) return "HIGH_UTILIZATION"
  if (card.dueInDays != null && card.dueInDays >= 0 && card.dueInDays <= DUE_SOON_DAYS && !card.dueCovered) {
    return "DUE_SOON"
  }
  return "OK"
}

export type StatusBadge = Lifecycle | Alert

/**
 * The one STATUS badge every surface renders (Blueprint Level 2):
 * 1. ARCHIVED rows are hidden by default (badge only in "include archived").
 * 2. FROZEN always wins — lifecycle outranks alerts.
 * 3. Otherwise the highest-priority alert.
 * Connection state NEVER appears here — it is the freshness indicator
 * plus an attention item.
 */
export function resolveStatusBadge(lifecycle: Lifecycle, alert: Alert): StatusBadge {
  if (lifecycle !== "ACTIVE") return lifecycle
  return alert
}
