/**
 * Pure create-card mapping (issue #26) — validated input → the row shape
 * the repository writes. Encodes the seed/import persistence conventions
 * so they are unit-testable without a database:
 *
 * - active promo ⇒ card-level regularAprBps is null; the post-promo rate
 *   lives on the PromoPeriod (regularAprBpsAfter) and the current balance
 *   is sheltered (shelteredBalanceMinor = currentBalanceMinor);
 * - provenance is presence-based: MANUAL when the user supplied a value,
 *   else UNKNOWN (aprSource is MANUAL when either an APR or a promo was
 *   supplied);
 * - an owner member ⇒ MEMBER attribution; none ⇒ SHARED (issue #78 — the
 *   "Shared" concept IS the absence of an owner); sync stays MANUAL until
 *   aggregator linking arrives.
 */
import type { CreateCardInput } from "@/features/cards/schemas/create-card-schema"
import type { EditCardInput } from "@/features/cards/schemas/edit-card-schema"

import { issuerKeyFor } from "./tracker-import"

/** Ready-to-write card shape — the repository persists this verbatim. */
export interface CreateCardData {
  cardName: string
  lastFour: string | null
  issuer: string
  issuerKey: string | null
  creditLimitMinor: bigint | null
  currentBalanceMinor: bigint
  regularAprBps: number | null
  paymentDueDay: number | null
  statementCloseDay: number | null
  minimumPaymentMinor: bigint | null
  paymentNote: string | null
  notes: string | null
  ownerMemberId: string | null
  attribution: "MEMBER" | "SHARED"
  syncStatus: "MANUAL"
  limitSource: "MANUAL" | "UNKNOWN"
  aprSource: "MANUAL" | "UNKNOWN"
  minimumSource: "MANUAL" | "UNKNOWN"
  promo: {
    endsOn: Date
    regularAprBpsAfter: number | null
    shelteredBalanceMinor: bigint
  } | null
}

export function toCreateCardData(input: CreateCardInput): CreateCardData {
  // The schema guarantees promoEndsOn when hasPromo — this narrows the type.
  const promoActive = input.hasPromo && input.promoEndsOn != null
  return {
    cardName: input.cardName,
    lastFour: input.lastFour,
    issuer: input.issuer,
    issuerKey: issuerKeyFor(input.issuer),
    creditLimitMinor: input.creditLimitMinor,
    currentBalanceMinor: input.currentBalanceMinor,
    regularAprBps: promoActive ? null : input.regularAprBps,
    paymentDueDay: input.paymentDueDay,
    statementCloseDay: input.statementCloseDay,
    minimumPaymentMinor: input.minimumPaymentMinor,
    paymentNote: input.paymentNote,
    notes: input.notes,
    ownerMemberId: input.ownerMemberId,
    attribution: input.ownerMemberId != null ? "MEMBER" : "SHARED",
    syncStatus: "MANUAL",
    limitSource: input.creditLimitMinor != null ? "MANUAL" : "UNKNOWN",
    aprSource: input.regularAprBps != null || promoActive ? "MANUAL" : "UNKNOWN",
    minimumSource: input.minimumPaymentMinor != null ? "MANUAL" : "UNKNOWN",
    promo: promoActive
      ? {
          endsOn: input.promoEndsOn!,
          regularAprBpsAfter: input.regularAprBps,
          shelteredBalanceMinor: input.currentBalanceMinor,
        }
      : null,
  }
}

/**
 * Update mapping (issue #47): identical conventions to create — presence-
 * based provenance, promo sheltering, owner attribution — minus syncStatus,
 * which a manual edit must never clobber.
 */
export type UpdateCardData = Omit<CreateCardData, "syncStatus">

export function toUpdateCardData(input: EditCardInput): UpdateCardData {
  const { syncStatus: _syncStatus, ...data } = toCreateCardData(input)
  return data
}

/**
 * Field names a card update changed — the audit event's changedFields
 * (names only, never values; the audit row stays PII-light). Bigints and
 * strings compare strictly; the promo compares by the ACTIVE promo's end
 * date + post-promo rate (its sheltered balance derives from the balance,
 * which the scalar list already covers).
 */
export function changedCardFields(
  before: Record<string, unknown> | null,
  data: UpdateCardData
): string[] {
  if (!before) return []
  const changed: string[] = []
  const scalarKeys = [
    "cardName",
    "lastFour",
    "issuer",
    "creditLimitMinor",
    "currentBalanceMinor",
    "regularAprBps",
    "paymentDueDay",
    "statementCloseDay",
    "minimumPaymentMinor",
    "paymentNote",
    "notes",
    "ownerMemberId",
  ] as const
  for (const key of scalarKeys) {
    if (before[key] !== data[key]) changed.push(key)
  }
  const beforePromo = (before.promoPeriods as Array<{ endsOn: Date; regularAprBpsAfter: number | null }> | undefined)?.[0]
  const promoChanged =
    (beforePromo?.endsOn?.getTime() ?? null) !== (data.promo?.endsOn.getTime() ?? null) ||
    (beforePromo?.regularAprBpsAfter ?? null) !== (data.promo?.regularAprBpsAfter ?? null)
  if (promoChanged) changed.push("promo")
  return changed
}

/**
 * Household + owner-member naming for a user's first household:
 * "<First>'s Household" from the user's first name, falling back to
 * "My Household"; the owner member is the first name or email local-part.
 */
export function deriveHouseholdIdentity(
  profile: { name: string | null; email: string | null } | null
): { householdName: string; displayName: string } {
  const firstName = profile?.name?.trim().split(/\s+/)[0] || null
  return {
    householdName: firstName ? `${firstName}'s Household` : "My Household",
    displayName: firstName ?? profile?.email?.split("@")[0] ?? "Owner",
  }
}
