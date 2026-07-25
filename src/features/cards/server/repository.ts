/**
 * Cards repository — the only module that touches Prisma for the cards
 * domain (arch doc §15). Authorization resolves through household
 * membership (EDR-014): a user sees the cards of households where a
 * HouseholdMember row carries their userId.
 */
import { prisma } from "@/lib/db/prisma"

import {
  deriveHouseholdIdentity,
  type CreateCardData,
  type UpdateCardData,
} from "./create-card-data"

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
 * WHERE (EDR-014): a cross-household or missing id updates zero rows.
 * Promo periods are inside the CreditCard aggregate (EDR-017) — the edit
 * replaces the ACTIVE promo set exactly like the tracker import's per-card
 * path: delete ACTIVE rows, recreate when the form's promo is on. The
 * card update and promo replace share one transaction. Returns the
 * PRE-update field values so the service can diff for the audit event.
 */
export async function updateCard(
  householdId: string,
  cardId: string,
  data: UpdateCardData
): Promise<{ updated: number; before: Record<string, unknown> | null }> {
  const { promo, ...card } = data
  return prisma.$transaction(async (tx) => {
    const before = await tx.creditCard.findFirst({
      where: { id: cardId, householdId },
      select: {
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
    const result = await tx.creditCard.updateMany({
      where: { id: cardId, householdId },
      data: card,
    })
    if (result.count === 0) return { updated: 0, before: null }
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
    return { updated: result.count, before }
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
