/** UTC date-only whole days from `today` until `date` (negative when past). */
export function daysUntil(date: Date, today: Date): number {
  const MS_PER_DAY = 86_400_000
  const a = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((b - a) / MS_PER_DAY)
}

/** Average month length in days — good enough for payoff planning. */
export const DAYS_PER_MONTH = 30.4375
