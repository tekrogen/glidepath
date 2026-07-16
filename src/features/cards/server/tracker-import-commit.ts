/**
 * Tracker-import commit path (Blueprint F16 / EDR-021 — issues #3, #28).
 *
 * The single idempotent write path shared by the CLI (scripts/import-tracker.ts)
 * and the upload UI. Match key for re-runs is the (household, cardName, issuer,
 * lastFour) quadruple — NEVER last-four alone; real portfolios contain
 * duplicates. Re-running with the same workbook is a no-op (every card resolves
 * to an update of identical data).
 *
 * Takes a PrismaClient so the CLI (its own client) and the server action (the
 * shared @/lib/db/prisma) drive byte-identical writes.
 */
import type { PrismaClient } from "@prisma/client"

import type { ParsedTrackerCard } from "./tracker-import"

export interface CommitTrackerImportOptions {
  userId: string
  /** Defaults to "<FirstName> Household (imported)". */
  householdName?: string
  /** Delete existing cards in the target household before importing. */
  replace?: boolean
}

export interface TrackerImportCardOutcome {
  cardName: string
  issuer: string
  lastFour: string | null
  outcome: "created" | "updated"
}

export interface TrackerImportResult {
  householdId: string
  householdName: string
  created: number
  updated: number
  removed: number
  cards: TrackerImportCardOutcome[]
}

export async function commitTrackerImport(
  prisma: PrismaClient,
  cards: ParsedTrackerCard[],
  opts: CommitTrackerImportOptions
): Promise<TrackerImportResult> {
  const user = await prisma.user.findUnique({ where: { id: opts.userId } })
  if (!user) throw new Error(`No user with id ${opts.userId}`)

  const householdName =
    opts.householdName ?? `${(user.name ?? "My").split(" ")[0]} Household (imported)`
  let household = await prisma.household.findFirst({ where: { name: householdName } })
  household ??= await prisma.household.create({ data: { name: householdName } })

  // The importing user is always an OWNER member of the target household.
  const ownerName = user.name?.split(" ")[0] ?? "Owner"
  await prisma.householdMember.upsert({
    where: { householdId_displayName: { householdId: household.id, displayName: ownerName } },
    update: { userId: user.id, role: "OWNER" },
    create: { householdId: household.id, displayName: ownerName, userId: user.id, role: "OWNER" },
  })

  let removed = 0
  if (opts.replace) {
    const gone = await prisma.creditCard.deleteMany({ where: { householdId: household.id } })
    removed = gone.count
  }

  const outcomes: TrackerImportCardOutcome[] = []
  let created = 0
  let updated = 0
  for (const c of cards) {
    let memberId: string | null = null
    if (c.ownerLabel) {
      const member = await prisma.householdMember.upsert({
        where: {
          householdId_displayName: { householdId: household.id, displayName: c.ownerLabel },
        },
        update: {},
        create: { householdId: household.id, displayName: c.ownerLabel },
      })
      memberId = member.id
    }

    const data = {
      ownerMemberId: memberId,
      attribution: (c.ownerLabel ? "MEMBER" : "SHARED") as "MEMBER" | "SHARED",
      issuerKey: c.issuerKey,
      creditLimitMinor: c.creditLimitMinor,
      currentBalanceMinor: c.currentBalanceMinor,
      regularAprBps: c.regularAprBps,
      paymentDueDay: c.paymentDueDay,
      minimumPaymentMinor: c.minimumPaymentMinor,
      paymentNote: c.paymentNote,
      notes: c.notes,
      limitSource: (c.creditLimitMinor != null ? "MANUAL" : "UNKNOWN") as "MANUAL" | "UNKNOWN",
      aprSource: (c.regularAprBps != null || c.promo != null ? "MANUAL" : "UNKNOWN") as
        | "MANUAL"
        | "UNKNOWN",
      minimumSource: (c.minimumPaymentMinor != null ? "MANUAL" : "UNKNOWN") as "MANUAL" | "UNKNOWN",
      syncStatus: "MANUAL" as const,
    }

    const existing = await prisma.creditCard.findFirst({
      where: {
        householdId: household.id,
        cardName: c.cardName,
        issuer: c.issuer,
        lastFour: c.lastFour,
      },
    })
    const card = existing
      ? await prisma.creditCard.update({ where: { id: existing.id }, data })
      : await prisma.creditCard.create({
          data: {
            ...data,
            householdId: household.id,
            cardName: c.cardName,
            issuer: c.issuer,
            lastFour: c.lastFour,
          },
        })
    if (existing) updated++
    else created++
    outcomes.push({
      cardName: c.cardName,
      issuer: c.issuer,
      lastFour: c.lastFour,
      outcome: existing ? "updated" : "created",
    })

    await prisma.promoPeriod.deleteMany({ where: { cardId: card.id, status: "ACTIVE" } })
    if (c.promo) {
      await prisma.promoPeriod.create({
        data: {
          cardId: card.id,
          promoAprBps: 0,
          regularAprBpsAfter: c.promo.regularAprBpsAfter,
          endsOn: c.promo.endsOn,
          shelteredBalanceMinor: c.currentBalanceMinor,
          status: "ACTIVE",
        },
      })
    }
  }

  return { householdId: household.id, householdName, created, updated, removed, cards: outcomes }
}
