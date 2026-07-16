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

  // One transaction for the whole import: a monetary mutation must be
  // all-or-nothing — the action's "nothing was changed" failure message
  // has to be literally true even when a write fails mid-portfolio.
  return prisma.$transaction(
    async (tx) => {
      // Default target is the user's OWN household (same seam the portfolio
      // reads — cards must land where /cards looks). A separate "(imported)"
      // household is created only when the user has none yet. An explicit
      // householdName (CLI --household) targets by name, scoped to the
      // user's own memberships — never join another user's household on a
      // name collision.
      let household: { id: string; name: string } | null
      if (opts.householdName) {
        household = await tx.household.findFirst({
          where: { name: opts.householdName, members: { some: { userId: user.id } } },
        })
        household ??= await tx.household.create({ data: { name: opts.householdName } })
      } else {
        const membership = await tx.householdMember.findFirst({
          where: { userId: user.id },
          include: { household: true },
        })
        household =
          membership?.household ??
          (await tx.household.create({
            data: { name: `${(user.name ?? "My").split(" ")[0]} Household (imported)` },
          }))
      }

      // The importing user is always a member of the target household —
      // skipped when a membership already exists (never duplicate the user
      // under a second display name).
      const existingMembership = await tx.householdMember.findFirst({
        where: { householdId: household.id, userId: user.id },
      })
      if (!existingMembership) {
        const ownerName = user.name?.split(" ")[0] ?? "Owner"
        await tx.householdMember.upsert({
          where: {
            householdId_displayName: { householdId: household.id, displayName: ownerName },
          },
          update: { userId: user.id, role: "OWNER" },
          create: { householdId: household.id, displayName: ownerName, userId: user.id, role: "OWNER" },
        })
      }
      const householdName = household.name

      let removed = 0
      if (opts.replace) {
        const gone = await tx.creditCard.deleteMany({ where: { householdId: household.id } })
        removed = gone.count
      }

      const outcomes: TrackerImportCardOutcome[] = []
      let created = 0
      let updated = 0
      for (const c of cards) {
        let memberId: string | null = null
        if (c.ownerLabel) {
          const member = await tx.householdMember.upsert({
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
          minimumSource: (c.minimumPaymentMinor != null ? "MANUAL" : "UNKNOWN") as
            | "MANUAL"
            | "UNKNOWN",
          syncStatus: "MANUAL" as const,
        }

        const existing = await tx.creditCard.findFirst({
          where: {
            householdId: household.id,
            cardName: c.cardName,
            issuer: c.issuer,
            lastFour: c.lastFour,
          },
        })
        const card = existing
          ? await tx.creditCard.update({ where: { id: existing.id }, data })
          : await tx.creditCard.create({
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

        await tx.promoPeriod.deleteMany({ where: { cardId: card.id, status: "ACTIVE" } })
        if (c.promo) {
          await tx.promoPeriod.create({
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
    },
    // A 20-card portfolio is ~80 sequential statements; give it headroom.
    { timeout: 30_000 }
  )
}
