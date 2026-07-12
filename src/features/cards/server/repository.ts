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

export async function findUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })
}

/** Household + its OWNER member (linked to the user) in one nested create. */
export async function createHouseholdWithOwner(
  userId: string,
  householdName: string,
  displayName: string
) {
  return prisma.household.create({
    data: {
      name: householdName,
      members: { create: { displayName, userId, role: "OWNER" } },
    },
    select: { id: true },
  })
}

/** Ready-to-write card shape — the service owns the domain mapping. */
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
  limitSource: "MANUAL" | "UNKNOWN"
  aprSource: "MANUAL" | "UNKNOWN"
  minimumSource: "MANUAL" | "UNKNOWN"
  promo: {
    endsOn: Date
    regularAprBpsAfter: number | null
    shelteredBalanceMinor: bigint
  } | null
}

export async function createCard(householdId: string, data: CreateCardData) {
  const { promo, ...card } = data
  return prisma.creditCard.create({
    data: {
      householdId,
      ...card,
      // Owner attribution arrives with household management UI later.
      ownerMemberId: null,
      attribution: "SHARED",
      syncStatus: "MANUAL",
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
