/** UTC date-only whole days from `today` until `date` (negative when past). */
export function daysUntil(date: Date, today: Date): number {
  const MS_PER_DAY = 86_400_000
  const a = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((b - a) / MS_PER_DAY)
}

/** Average month length in days — good enough for payoff planning. */
export const DAYS_PER_MONTH = 30.4375

/** `date` + `days` in UTC date-only space (negative allowed). */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

/** Day-of-month `day` in (UTC year, monthIndex), clamped to the month's last day. */
export function clampedUtcDate(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay)))
}

/**
 * Every occurrence of a day-of-month within [today, today + horizonDays),
 * UTC date-only, ascending. A 45-day horizon can contain the same due day
 * twice (e.g. day 15 from Jul 11 → Jul 15 AND Aug 15).
 */
export function occurrencesInWindow(day: number, today: Date, horizonDays: number): Date[] {
  const out: Date[] = []
  const monthsToScan = Math.ceil(horizonDays / 28) + 1
  for (let m = 0; m <= monthsToScan; m++) {
    const candidate = clampedUtcDate(today.getUTCFullYear(), today.getUTCMonth() + m, day)
    const delta = daysUntil(candidate, today)
    if (delta >= 0 && delta < horizonDays) out.push(candidate)
  }
  return out
}
