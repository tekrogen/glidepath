/**
 * Due-date helpers — next occurrence of a 1–31 due day (date-only, UTC,
 * clamped to short months). The cards service and the attention builder
 * (issue #25) both derive from it; the clamp itself is owned by
 * lib/finance (`clampedUtcDate`, issue #43).
 */
import { clampedUtcDate, daysUntil } from "@/lib/finance"

/** The next due date on or after `today`, or null when no due day is known. */
export function nextDueDate(paymentDueDay: number | null, today: Date): Date | null {
  if (paymentDueDay == null) return null
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const thisMonth = clampedUtcDate(y, m, paymentDueDay)
  return daysUntil(thisMonth, today) >= 0 ? thisMonth : clampedUtcDate(y, m + 1, paymentDueDay)
}

/** Days until the next occurrence of a 1–31 due day (date-only, UTC). */
export function dueInDays(paymentDueDay: number | null, today: Date): number | null {
  const next = nextDueDate(paymentDueDay, today)
  return next == null ? null : daysUntil(next, today)
}
