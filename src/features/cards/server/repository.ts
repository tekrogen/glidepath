/**
 * Cards repository — the only module that touches Prisma for the cards
 * domain (arch doc §15). Authorization resolves through household
 * membership (EDR-014): a user sees the cards of households where a
 * HouseholdMember row carries their userId.
 */
import type { SuggestedCardField } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"

import {
  deriveHouseholdIdentity,
  type CreateCardData,
  type UpdateCardData,
} from "./create-card-data"
import type { LiabilityApplyPlan } from "./liabilities-plan"

export type CardRow = NonNullable<Awaited<ReturnType<typeof findHouseholdCards>>>[number]

export async function findHouseholdIdForUser(userId: string): Promise<string | null> {
  const member = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true },
  })
  return member?.householdId ?? null
}

/**
 * The user's household id, creating "<First>'s Household" + OWNER member
 * on first use so zero-card users are functional (issue #26). Find and
 * create share one transaction to narrow the duplicate-household window;
 * the residual race (two concurrent FIRST mutations for one user) is
 * accepted — this is a single-user product and the form disables submit
 * while pending.
 */
export async function findOrCreateHouseholdForUser(userId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const member = await tx.householdMember.findFirst({
      where: { userId },
      select: { householdId: true },
    })
    if (member) return member.householdId
    const profile = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    const { householdName, displayName } = deriveHouseholdIdentity(profile)
    const household = await tx.household.create({
      data: {
        name: householdName,
        members: { create: { displayName, userId, role: "OWNER" } },
      },
      select: { id: true },
    })
    return household.id
  })
}

export async function createCard(householdId: string, data: CreateCardData) {
  const { promo, ...card } = data
  return prisma.creditCard.create({
    data: {
      householdId,
      ...card,
      promoPeriods: promo
        ? {
            create: {
              promoAprBps: 0,
              regularAprBpsAfter: promo.regularAprBpsAfter,
              endsOn: promo.endsOn,
              shelteredBalanceMinor: promo.shelteredBalanceMinor,
              status: "ACTIVE",
            },
          }
        : undefined,
    },
    select: { id: true },
  })
}

/**
 * Set a card's lifecycle within the caller's household (issue #27). The
 * householdId in the WHERE is the authz gate: a card outside the caller's
 * household matches zero rows → updated === 0, indistinguishable from a
 * missing id (the correct authz posture, and no separate existence read =
 * no TOCTOU). Returns the card name for the audit event.
 */
export async function setCardLifecycle(
  householdId: string,
  cardId: string,
  lifecycle: "ACTIVE" | "FROZEN"
): Promise<{ updated: number; cardName: string | null }> {
  const result = await prisma.creditCard.updateMany({
    where: { id: cardId, householdId },
    data: { lifecycle },
  })
  const card = result.count
    ? await prisma.creditCard.findFirst({
        where: { id: cardId, householdId },
        select: { cardName: true },
      })
    : null
  return { updated: result.count, cardName: card?.cardName ?? null }
}

/** The household's cards in Monarch-matcher shape (issue #48) — the ONLY
 *  Prisma read the Monarch actions consume (arch §15: repository owns
 *  Prisma for the cards domain). */
export async function findMatchableCards(householdId: string) {
  return prisma.creditCard.findMany({
    where: { householdId },
    select: {
      id: true,
      cardName: true,
      issuer: true,
      lastFour: true,
      currency: true,
      monarchAccountKey: true,
      currentBalanceMinor: true,
    },
    orderBy: [{ cardName: "asc" }],
  })
}

/** Household members for the owner picker (issue #78) — label data only. */
export async function findHouseholdMembers(householdId: string) {
  return prisma.householdMember.findMany({
    where: { householdId },
    select: { id: true, displayName: true },
    orderBy: [{ displayName: "asc" }],
  })
}

/** True iff the member belongs to the household — the owner-picker FK
 *  verification (EDR-014; the #45 cross-tenant lesson). */
export async function verifyHouseholdMember(
  householdId: string,
  memberId: string
): Promise<boolean> {
  const count = await prisma.householdMember.count({ where: { id: memberId, householdId } })
  return count > 0
}

/**
 * Update a card within the caller's household (issue #47). Household-scoped
 * WHERE (EDR-014): a cross-household or missing id matches zero rows
 * ("not-found"). The write is a compare-and-swap on updatedAt (review
 * finding: a stale edit-sheet seed must not silently overwrite a
 * concurrent edit — "conflict", nothing written). Promo periods are inside
 * the CreditCard aggregate (EDR-017) — the edit replaces the ACTIVE promo
 * set exactly like the tracker import's per-card path. The read, the CAS
 * update, and the promo replace share one transaction. Returns the
 * PRE-update field values so the service can diff for the audit event.
 */
export async function updateCard(
  householdId: string,
  cardId: string,
  data: UpdateCardData,
  expectedUpdatedAt: Date
): Promise<{
  status: "ok" | "not-found" | "conflict"
  before: Record<string, unknown> | null
}> {
  const { promo, ...card } = data
  return prisma.$transaction(async (tx) => {
    const before = await tx.creditCard.findFirst({
      where: { id: cardId, householdId },
      select: {
        updatedAt: true,
        cardName: true,
        lastFour: true,
        issuer: true,
        creditLimitMinor: true,
        currentBalanceMinor: true,
        regularAprBps: true,
        paymentDueDay: true,
        statementCloseDay: true,
        minimumPaymentMinor: true,
        paymentNote: true,
        notes: true,
        ownerMemberId: true,
        promoPeriods: {
          where: { status: "ACTIVE" },
          select: { endsOn: true, regularAprBpsAfter: true },
        },
      },
    })
    if (!before) return { status: "not-found" as const, before: null }
    if (before.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return { status: "conflict" as const, before: null }
    }
    await tx.creditCard.updateMany({
      where: { id: cardId, householdId },
      data: card,
    })
    await tx.promoPeriod.deleteMany({ where: { cardId, status: "ACTIVE" } })
    if (promo) {
      await tx.promoPeriod.create({
        data: {
          cardId,
          promoAprBps: 0,
          regularAprBpsAfter: promo.regularAprBpsAfter,
          endsOn: promo.endsOn,
          shelteredBalanceMinor: promo.shelteredBalanceMinor,
          status: "ACTIVE",
        },
      })
    }
    return { status: "ok" as const, before }
  })
}

/**
 * The Restrict-FK rows that would go with a card (issue #57) — read for
 * the delete confirmation, household-scoped like every card read.
 */
export async function findCardDependents(householdId: string, cardId: string) {
  const card = await prisma.creditCard.findFirst({
    where: { id: cardId, householdId },
    select: {
      cardName: true,
      _count: { select: { scheduledPayments: true, statements: true } },
      autopayLink: { select: { id: true } },
    },
  })
  if (!card) return null
  return {
    cardName: card.cardName,
    scheduledPayments: card._count.scheduledPayments,
    statements: card._count.statements,
    autopayLink: card.autopayLink != null,
  }
}

/**
 * Delete a card and its Restrict-FK dependents in one transaction (issue
 * #47 + #57's delete half): scheduled payments, statements, and the
 * autopay link are removed explicitly — never by cascade (the Restrict
 * contract exists so this resolution is a stated, audited choice).
 * PaymentIntents cascade by schema (ephemeral drafts). Household-scoped
 * WHERE throughout; zero rows deleted ⇒ cross-household or missing id.
 */
export async function deleteCardWithDependents(
  householdId: string,
  cardId: string
): Promise<{
  deleted: number
  cardName: string | null
  removedScheduledPayments: number
  removedStatements: number
  removedAutopayLink: boolean
} | null> {
  return prisma.$transaction(async (tx) => {
    const card = await tx.creditCard.findFirst({
      where: { id: cardId, householdId },
      select: { cardName: true },
    })
    if (!card) return null
    const payments = await tx.scheduledPayment.deleteMany({
      where: { cardId, card: { householdId } },
    })
    const statements = await tx.statement.deleteMany({
      where: { cardId, card: { householdId } },
    })
    const autopay = await tx.providerAutopayLink.deleteMany({
      where: { cardId, card: { householdId } },
    })
    const result = await tx.creditCard.deleteMany({ where: { id: cardId, householdId } })
    return {
      deleted: result.count,
      cardName: card.cardName,
      removedScheduledPayments: payments.count,
      removedStatements: statements.count,
      removedAutopayLink: autopay.count > 0,
    }
  })
}

// ─── Plaid Liabilities epic (issue #109) ──────────────────────────────
// The PlaidAccount spine (#107) is the only join surface between Plaid and
// the card domain — accountId/creditCardId keys, never masks. These reads
// authorize through plaidItem.userId (the linking user), the writes through
// householdId like every other card mutation.

/** Credit-subtype Plaid accounts not yet imported as cards — the discovery list. */
export async function findDiscoveredCreditAccounts(userId: string) {
  return prisma.plaidAccount.findMany({
    where: {
      creditCardId: null,
      plaidItem: { userId, status: "ACTIVE" },
      userAccount: { type: "CREDIT" },
    },
    select: {
      id: true,
      mask: true,
      name: true,
      plaidItem: { select: { id: true, institutionName: true } },
      userAccount: { select: { name: true, balance: true, currency: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  })
}

export interface DiscoveredCardCreate {
  plaidAccountId: string
  cardName: string
  issuer: string
  issuerKey: string | null
  lastFour: string | null
  currency: string
  currentBalanceMinor: bigint
}

/**
 * Import confirmed discovered accounts as cards: one transaction creates each
 * card (syncStatus SYNC_PENDING — the honest post-link state, filled by the
 * liabilities sync that follows) and claims its PlaidAccount link. The
 * per-account re-check inside the transaction makes a double-submit or a
 * concurrent import skip the row instead of creating a duplicate card.
 */
export async function createDiscoveredCards(
  userId: string,
  householdId: string,
  cards: DiscoveredCardCreate[]
): Promise<{ cardId: string; cardName: string; plaidItemId: string }[]> {
  return prisma.$transaction(async (tx) => {
    const created: { cardId: string; cardName: string; plaidItemId: string }[] = []
    for (const card of cards) {
      const link = await tx.plaidAccount.findFirst({
        where: {
          id: card.plaidAccountId,
          creditCardId: null,
          plaidItem: { userId },
        },
        select: { id: true, plaidItemId: true },
      })
      if (!link) continue
      const row = await tx.creditCard.create({
        data: {
          householdId,
          cardName: card.cardName,
          issuer: card.issuer,
          issuerKey: card.issuerKey,
          lastFour: card.lastFour,
          currency: card.currency,
          currentBalanceMinor: card.currentBalanceMinor,
          attribution: "SHARED",
          syncStatus: "SYNC_PENDING",
        },
        select: { id: true, cardName: true },
      })
      await tx.plaidAccount.update({
        where: { id: link.id },
        data: { creditCardId: row.id },
      })
      created.push({ cardId: row.id, cardName: row.cardName, plaidItemId: link.plaidItemId })
    }
    return created
  })
}

/** The item's linked cards with the provenance snapshot the planner gates on. */
export async function findPlaidLinkedCards(plaidItemId: string) {
  return prisma.plaidAccount.findMany({
    where: { plaidItemId, creditCardId: { not: null } },
    select: {
      accountId: true,
      creditCard: {
        select: {
          id: true,
          householdId: true,
          currency: true,
          regularAprBps: true,
          aprSource: true,
          creditLimitMinor: true,
          limitSource: true,
          minimumPaymentMinor: true,
          minimumSource: true,
          paymentDueDay: true,
          dueDaySource: true,
          promoPeriods: { where: { status: "ACTIVE" }, select: { id: true } },
        },
      },
    },
  })
}

/**
 * Apply one card's liability plan: field sets + SYNCED stamp, and the
 * suggestion transitions — created PENDING when new; re-opened when the
 * provider's proposal CHANGED (dismissal pins the user's value against that
 * proposal only); left untouched when the proposal is unchanged.
 * Returns how many suggestions were created or re-opened.
 */
export async function applyLiabilityPlan(
  cardId: string,
  plan: LiabilityApplyPlan,
  syncedAt: Date
): Promise<{ suggestionsOpened: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.creditCard.update({
      where: { id: cardId },
      data: { ...plan.sets, syncStatus: "SYNCED", lastSyncedAt: syncedAt },
    })
    let suggestionsOpened = 0
    for (const s of plan.suggestions) {
      const field = s.field as SuggestedCardField
      const existing = await tx.cardProviderSuggestion.findUnique({
        where: { cardId_field: { cardId, field } },
        select: { id: true, proposedValue: true, status: true },
      })
      if (!existing) {
        await tx.cardProviderSuggestion.create({
          data: {
            cardId,
            field,
            proposedValue: s.proposedValue,
            currentValue: s.currentValue,
          },
        })
        suggestionsOpened++
      } else if (existing.proposedValue !== s.proposedValue) {
        await tx.cardProviderSuggestion.update({
          where: { id: existing.id },
          data: {
            proposedValue: s.proposedValue,
            currentValue: s.currentValue,
            status: "PENDING",
            resolvedAt: null,
          },
        })
        suggestionsOpened++
      } else if (existing.status === "PENDING") {
        await tx.cardProviderSuggestion.update({
          where: { id: existing.id },
          data: { currentValue: s.currentValue },
        })
      }
      // Same proposal already ACCEPTED/DISMISSED — pinned, nothing to do.
    }
    return { suggestionsOpened }
  })
}

/** Sweep the item's linked cards to a sync status (SYNC_FAILED on error paths). */
export async function markPlaidCardsSyncStatus(
  plaidItemId: string,
  syncStatus: "SYNCED" | "SYNC_FAILED",
  syncedAt?: Date
) {
  return prisma.creditCard.updateMany({
    where: { plaidAccount: { plaidItemId } },
    data: { syncStatus, ...(syncedAt ? { lastSyncedAt: syncedAt } : {}) },
  })
}

/** Pending provider suggestions across the household — the review panel read. */
export async function findPendingSuggestions(householdId: string) {
  return prisma.cardProviderSuggestion.findMany({
    where: { status: "PENDING", card: { householdId } },
    select: {
      id: true,
      field: true,
      proposedValue: true,
      currentValue: true,
      createdAt: true,
      card: { select: { id: true, cardName: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  })
}

/** Column mapping for an accepted suggestion — provenance flips to PLAID. */
function suggestionApplyData(field: SuggestedCardField, value: string) {
  switch (field) {
    case "REGULAR_APR_BPS":
      return { regularAprBps: Number(value), aprSource: "PLAID" as const }
    case "CREDIT_LIMIT_MINOR":
      return { creditLimitMinor: BigInt(value), limitSource: "PLAID" as const }
    case "MINIMUM_PAYMENT_MINOR":
      return { minimumPaymentMinor: BigInt(value), minimumSource: "PLAID" as const }
    case "PAYMENT_DUE_DAY":
      return { paymentDueDay: Number(value), dueDaySource: "PLAID" as const }
  }
}

/**
 * Resolve a PENDING suggestion within the caller's household. Accepting
 * applies the proposed value and flips the field's provenance to PLAID;
 * dismissing pins the user's value against this proposal. Household-scoped
 * WHERE throughout (EDR-014); returns null for cross-household/missing/
 * already-resolved ids.
 */
export async function resolveSuggestion(
  householdId: string,
  suggestionId: string,
  resolution: "accepted" | "dismissed"
): Promise<{ cardId: string; cardName: string; field: SuggestedCardField } | null> {
  return prisma.$transaction(async (tx) => {
    const suggestion = await tx.cardProviderSuggestion.findFirst({
      where: { id: suggestionId, status: "PENDING", card: { householdId } },
      select: {
        id: true,
        field: true,
        proposedValue: true,
        card: { select: { id: true, cardName: true } },
      },
    })
    if (!suggestion) return null
    if (resolution === "accepted") {
      await tx.creditCard.updateMany({
        where: { id: suggestion.card.id, householdId },
        data: suggestionApplyData(suggestion.field, suggestion.proposedValue),
      })
    }
    await tx.cardProviderSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: resolution === "accepted" ? "ACCEPTED" : "DISMISSED",
        resolvedAt: new Date(),
      },
    })
    return {
      cardId: suggestion.card.id,
      cardName: suggestion.card.cardName,
      field: suggestion.field,
    }
  })
}

export async function findHouseholdCards(householdId: string, includeArchived = false) {
  return prisma.creditCard.findMany({
    where: {
      householdId,
      ...(includeArchived ? {} : { lifecycle: { not: "ARCHIVED" } }),
    },
    include: {
      promoPeriods: { where: { status: "ACTIVE" } },
      ownerMember: { select: { id: true, displayName: true } },
      // EDR-016 metadata: feeds the PAY/AUTO affordances + dueCovered (issue #46).
      autopayLink: { select: { autopayActive: true, providerUrl: true } },
      // Restrict-FK dependents (issue #47): the delete confirm lists these.
      _count: { select: { scheduledPayments: true, statements: true } },
    },
    orderBy: [{ cardName: "asc" }],
  })
}
