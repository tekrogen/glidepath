/**
 * Stepper draft schema (issue #45, EDR-012). Typed client state in →
 * validated partial draft out. Every field is optional — a draft is
 * allowed to be incomplete by design; what IS present must be valid.
 * Money parsing is lib/finance's (EDR-019); this file only validates and
 * shapes. Completeness is the confirm step's job (utils/intent.ts).
 */
import { z } from "zod"

import { daysUntil, MAX_AMOUNT_MINOR, parseDollarsToMinor } from "@/lib/finance"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Longest future date the stepper accepts — a year out is a plan, not a typo. */
export const MAX_SCHEDULE_DAYS = 365

/** "" → null; else a valid positive dollar amount within bounds. */
const amountField = z
  .string()
  .optional()
  .default("")
  .transform((v, ctx) => {
    if (v.trim() === "") return null
    const minor = parseDollarsToMinor(v)
    if (minor == null) {
      ctx.addIssue({ code: "custom", message: "Enter the amount as dollars, like 350.00." })
      return z.NEVER
    }
    if (minor <= 0n) {
      ctx.addIssue({ code: "custom", message: "Amount must be greater than zero." })
      return z.NEVER
    }
    if (minor > MAX_AMOUNT_MINOR) {
      ctx.addIssue({ code: "custom", message: "Amount must be $99,999,999.99 or less." })
      return z.NEVER
    }
    return minor
  })

/** "" → null; else a real calendar date (round-trip exact), today..+365. */
const scheduledForField = (today: Date) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v, ctx) => {
      if (v.trim() === "") return null
      const t = v.trim()
      const date = new Date(`${t}T00:00:00Z`)
      // Round-trip check: Date.parse rolls over out-of-range days
      // ("2026-02-31" → Mar 3) — reject, never reinterpret.
      if (!ISO_DATE.test(t) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== t) {
        ctx.addIssue({ code: "custom", message: "Enter a real date (YYYY-MM-DD)." })
        return z.NEVER
      }
      const days = daysUntil(date, today)
      if (days < 0) {
        ctx.addIssue({ code: "custom", message: "The date can't be in the past." })
        return z.NEVER
      }
      if (days > MAX_SCHEDULE_DAYS) {
        ctx.addIssue({ code: "custom", message: "Schedule within the next year." })
        return z.NEVER
      }
      return date
    })

const idField = z
  .string()
  .optional()
  .default("")
  .transform((v) => (v.trim() === "" ? null : v.trim()))

export const intentDraftSchema = (today: Date) =>
  z.object({
    intentId: idField,
    cardId: idField,
    amount: amountField,
    scheduledFor: scheduledForField(today),
    fundingAccountId: idField,
    note: z
      .string()
      .optional()
      .default("")
      .transform((v) => v.trim())
      .pipe(z.string().max(200, "Notes are limited to 200 characters."))
      .transform((v) => (v === "" ? null : v)),
  })

export type IntentDraftInput = z.output<ReturnType<typeof intentDraftSchema>>
