/**
 * Create-card form schema (issue #26, arch doc §15).
 *
 * FormData strings in → typed CreateCardInput out. Money conversions are
 * the pure parsers in lib/finance (EDR-019); this file only validates and
 * shapes. Issue paths use the FORM field names so fieldErrors line up with
 * the inputs; the final transform renames to domain names (…Minor, …Bps).
 */
import { z } from "zod"

import { MAX_AMOUNT_MINOR, parseDollarsToMinor, percentToBps } from "@/lib/finance"

/** "" → null; else must be a valid dollar amount within the given bounds. */
function dollarsField(label: string, opts: { positive?: boolean } = {}) {
  return z
    .string()
    .optional()
    .default("")
    .transform((v, ctx) => {
      if (v.trim() === "") return null
      const minor = parseDollarsToMinor(v)
      if (minor == null) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} as a dollar amount, like 1250.00.` })
        return z.NEVER
      }
      if (minor > MAX_AMOUNT_MINOR) {
        ctx.addIssue({
          code: "custom",
          message: `${label[0].toUpperCase()}${label.slice(1)} must be $99,999,999.99 or less.`,
        })
        return z.NEVER
      }
      if (opts.positive && minor <= 0n) {
        ctx.addIssue({ code: "custom", message: `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero.` })
        return z.NEVER
      }
      return minor
    })
}

/** "" → null; else an integer day of month 1–31. */
function dayOfMonthField() {
  return z
    .string()
    .optional()
    .default("")
    .transform((v, ctx) => {
      if (v.trim() === "") return null
      if (!/^\d+$/.test(v.trim())) {
        ctx.addIssue({ code: "custom", message: "Enter a day of the month (1–31)." })
        return z.NEVER
      }
      const day = Number(v.trim())
      if (day < 1 || day > 31) {
        ctx.addIssue({ code: "custom", message: "Enter a day of the month (1–31)." })
        return z.NEVER
      }
      return day
    })
}

export const createCardSchema = z
  .object({
    cardName: z
      .string({ error: "Give the card a name." })
      .trim()
      .min(1, "Give the card a name.")
      .max(80, "Card names are limited to 80 characters."),
    issuer: z
      .string({ error: "Enter the issuer." })
      .trim()
      .min(1, "Enter the issuer.")
      .max(60, "Issuer names are limited to 60 characters."),
    lastFour: z
      .string()
      .optional()
      .default("")
      // Spaces and dashes are formatting; anything else stays put so a
      // typo like "12ab34" errors instead of silently becoming "1234".
      .transform((v) => v.replace(/[\s-]/g, ""))
      .refine((v) => v === "" || /^\d{4}$/.test(v), {
        message: "Only the last 4 digits — never the full card number.",
      })
      .transform((v) => (v === "" ? null : v)),
    creditLimit: dollarsField("the credit limit", { positive: true }),
    currentBalance: dollarsField("the current balance").transform((v) => v ?? 0n),
    hasPromo: z
      .string()
      .optional()
      .transform((v) => v === "on" || v === "true"),
    promoEndsOn: z
      .string()
      .optional()
      .default("")
      .transform((v, ctx) => {
        const t = v.trim()
        if (t === "") return null
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          ctx.addIssue({ code: "custom", message: "Enter the promo end date as a calendar date." })
          return z.NEVER
        }
        const date = new Date(`${t}T00:00:00Z`)
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== t) {
          ctx.addIssue({ code: "custom", message: "Enter the promo end date as a calendar date." })
          return z.NEVER
        }
        return date
      }),
    regularApr: z
      .string()
      .optional()
      .default("")
      .transform((v, ctx) => {
        if (v.trim() === "") return null
        const bps = percentToBps(v)
        if (bps == null) {
          ctx.addIssue({ code: "custom", message: "Enter the APR as a percentage between 0 and 99.99." })
          return z.NEVER
        }
        return bps
      }),
    paymentDueDay: dayOfMonthField(),
    statementCloseDay: dayOfMonthField(),
    minimumPayment: dollarsField("the minimum payment"),
    paymentNote: z
      .string()
      .optional()
      .default("")
      .transform((v) => v.trim())
      .refine((v) => v.length <= 200, { message: "Payment notes are limited to 200 characters." })
      .transform((v) => v || null),
    notes: z
      .string()
      .optional()
      .default("")
      .transform((v) => v.trim())
      .refine((v) => v.length <= 2000, { message: "Notes are limited to 2000 characters." })
      .transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    // Past dates are legal data — an already-expired promo is the status
    // engine's business, not the form's.
    if (v.hasPromo && v.promoEndsOn == null) {
      ctx.addIssue({
        code: "custom",
        path: ["promoEndsOn"],
        message: "Enter when the 0% promo ends.",
      })
    }
  })
  .transform((v) => ({
    cardName: v.cardName,
    issuer: v.issuer,
    lastFour: v.lastFour,
    creditLimitMinor: v.creditLimit,
    currentBalanceMinor: v.currentBalance,
    hasPromo: v.hasPromo,
    promoEndsOn: v.hasPromo ? v.promoEndsOn : null,
    regularAprBps: v.regularApr,
    paymentDueDay: v.paymentDueDay,
    statementCloseDay: v.statementCloseDay,
    minimumPaymentMinor: v.minimumPayment,
    paymentNote: v.paymentNote,
    notes: v.notes,
  }))

export type CreateCardInput = z.output<typeof createCardSchema>
