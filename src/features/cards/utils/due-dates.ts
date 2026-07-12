/**
 * Due-date helpers — next occurrence of a 1–31 due day (date-only, UTC,
 * clamped to short months). The single owner of the due-day clamp: the
 * cards service and the attention builder (issue #25) both derive from it.
 */
import { daysUntil } from "@/lib/finance"

/** The next due date on or after `today`, or null when no due day is known. */
export function nextDueDate(paymentDueDay: number | null, today: Date): Date | null {
  if (paymentDueDay == null) return null
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const clamp = (yy: number, mm: number) => {
    const lastDay = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate()
    return new Date(Date.UTC(yy, mm, Math.min(paymentDueDay, lastDay)))
  }
  const thisMonth = clamp(y, m)
  return daysUntil(thisMonth, today) >= 0 ? thisMonth : clamp(y, m + 1)
}

/** Days until the next occurrence of a 1–31 due day (date-only, UTC). */
export function dueInDays(paymentDueDay: number | null, today: Date): number | null {
  const next = nextDueDate(paymentDueDay, today)
  return next == null ? null : daysUntil(next, today)
}
