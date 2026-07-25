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
  .extend({ cardId: z.string().min(1, "Missing card id.") })
  .superRefine(cardPromoRefine)
  .transform((v) => ({ ...toCardDomain(v), cardId: v.cardId }))

export type EditCardInput = z.output<typeof editCardSchema>
