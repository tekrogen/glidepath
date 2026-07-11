/**
 * Cards repository — the only module that touches Prisma for the cards
 * domain (arch doc §15). Authorization resolves through household
 * membership (EDR-014): a user sees the cards of households where a
 * HouseholdMember row carries their userId.
 */
import { prisma } from "@/lib/db/prisma"

export type CardRow = NonNullable<Awaited<ReturnType<typeof findHouseholdCards>>>[number]

export async function findHouseholdIdForUser(userId: string): Promise<string | null> {
  const member = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true },
  })
  return member?.householdId ?? null
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
