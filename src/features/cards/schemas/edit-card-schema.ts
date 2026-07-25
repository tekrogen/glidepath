/**
 * Edit-card form schema (issue #47) — the shared card form shape plus the
 * card id. Parsers, bounds, and the promo refine are create-card-schema's
 * (one rule, two forms); only the id is new. Ownership of the id is
 * verified server-side via the household-scoped WHERE (EDR-014), never
 * here.
 */
import { z } from "zod"

import {
  cardFormObject,
  cardPromoRefine,
  toCardDomain,
} from "./create-card-schema"

export const editCardSchema = cardFormObject
  .extend({
    cardId: z.string().min(1, "Missing card id."),
    /** The row version the form was seeded from (ISO timestamp) — the
     *  compare-and-swap guard against silently overwriting a concurrent
     *  edit (review finding: lost update). */
    expectedUpdatedAt: z
      .string()
      .min(1, "Missing card version.")
      .transform((v, ctx) => {
        const date = new Date(v)
        if (Number.isNaN(date.getTime())) {
          ctx.addIssue({ code: "custom", message: "Missing card version." })
          return z.NEVER
        }
        return date
      }),
  })
  .superRefine(cardPromoRefine)
  .transform((v) => ({
    ...toCardDomain(v),
    cardId: v.cardId,
    expectedUpdatedAt: v.expectedUpdatedAt,
  }))

export type EditCardInput = z.output<typeof editCardSchema>
