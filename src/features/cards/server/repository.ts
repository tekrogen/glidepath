/**
 * Cards repository — the only module that touches Prisma for the cards
 * domain (arch doc §15). Authorization resolves through household
 * membership (EDR-014): a user sees the cards of households where a
 * HouseholdMember row carries their userId.
 */
import { prisma } from "@/lib/db/prisma"

import { deriveHouseholdIdentity, type CreateCardData } from "./create-card-data"

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

export async function findHouseholdCards(householdId: string, includeArchived = false) {
  return prisma.creditCard.findMany({
    where: {
      householdId,
      ...(includeArchived ? {} : { lifecycle: { not: "ARCHIVED" } }),
    },
    include: {
      promoPeriods: { where: { status: "ACTIVE" } },
      ownerMember: { select: { id: true, displayName: true } },
    },
    orderBy: [{ cardName: "asc" }],
  })
}
