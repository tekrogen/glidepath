/**
 * Payments repository — the only module that touches Prisma for the
 * payments domain (arch doc §15): ScheduledPayment, PaymentIntent, and
 * FinancialAccount metadata. Card rows come from the cards repository
 * (that domain owns them). Authorization is the household id in the
 * WHERE (EDR-014): a cross-household id matches zero rows — no separate
 * existence read, no TOCTOU.
 */
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import type { Minor } from "@/lib/finance"

export type ScheduledPaymentRow = Awaited<ReturnType<typeof findScheduledPayments>>[number]

/** Unresolved SCHEDULED rows for the household's cards; window filtering is the engine's job. */
export async function findScheduledPayments(householdId: string) {
  return prisma.scheduledPayment.findMany({
    where: { status: "SCHEDULED", card: { householdId } },
    select: {
      id: true,
      cardId: true,
      amountMinor: true,
      scheduledFor: true,
      status: true,
    },
    orderBy: [{ scheduledFor: "asc" }],
  })
}

/**
 * Verify draft foreign keys belong to the household (review finding —
 * critical): the intent row's WHERE scopes only the intent; the cardId /
 * fundingAccountId payload must be resolved through household-scoped
 * lookups too, or a crafted save writes another household's ids and
 * confirm records a payment onto their card (EDR-014).
 */
export async function verifyDraftReferences(
  householdId: string,
  cardId: string | null,
  fundingAccountId: string | null
): Promise<{ cardOk: boolean; accountOk: boolean }> {
  const [card, account] = await Promise.all([
    cardId == null
      ? Promise.resolve(1)
      : prisma.creditCard.count({ where: { id: cardId, householdId } }),
    fundingAccountId == null
      ? Promise.resolve(1)
      : prisma.financialAccount.count({ where: { id: fundingAccountId, householdId } }),
  ])
  return { cardOk: card > 0, accountOk: account > 0 }
}

/** Funding-account labels for the stepper's picker — metadata, never balances (EDR-010). */
export async function findFundingAccounts(householdId: string) {
  return prisma.financialAccount.findMany({
    where: { householdId },
    select: { id: true, name: true, institution: true, lastFour: true },
    orderBy: [{ name: "asc" }],
  })
}

const INTENT_SELECT = {
  id: true,
  cardId: true,
  fundingAccountId: true,
  amountMinor: true,
  scheduledFor: true,
  note: true,
  status: true,
  expiresAt: true,
} satisfies Prisma.PaymentIntentSelect

export type IntentRow = NonNullable<Awaited<ReturnType<typeof findActiveDraft>>>

/** The household's newest un-expired DRAFT — the resumable stepper state. */
export async function findActiveDraft(householdId: string, now: Date) {
  return prisma.paymentIntent.findFirst({
    where: { householdId, status: "DRAFT", expiresAt: { gt: now } },
    select: INTENT_SELECT,
    orderBy: [{ updatedAt: "desc" }],
  })
}

export async function createDraft(householdId: string, expiresAt: Date) {
  return prisma.paymentIntent.create({
    data: { householdId, expiresAt },
    select: INTENT_SELECT,
  })
}

/**
 * Update a live draft's fields (sliding TTL — every save re-arms
 * expiresAt). The WHERE carries household + DRAFT + un-expired: an
 * expired, submitted, or cross-household id updates zero rows.
 */
export async function updateDraft(
  householdId: string,
  intentId: string,
  data: {
    cardId?: string | null
    fundingAccountId?: string | null
    amountMinor?: Minor | null
    scheduledFor?: Date | null
    note?: string | null
  },
  now: Date,
  expiresAt: Date
): Promise<number> {
  const result = await prisma.paymentIntent.updateMany({
    where: { id: intentId, householdId, status: "DRAFT", expiresAt: { gt: now } },
    data: { ...data, expiresAt },
  })
  return result.count
}

/** Delete a live draft (start-over). Ephemeral by design — no audit row. */
export async function deleteDraft(householdId: string, intentId: string): Promise<number> {
  const result = await prisma.paymentIntent.deleteMany({
    where: { id: intentId, householdId, status: "DRAFT" },
  })
  return result.count
}

/**
 * Flip every stale DRAFT to EXPIRED (issue #46 cron; #45 deferred this).
 * Global by design — the cron acts across households; returns the flipped
 * rows with each household's members so the service can attribute the
 * PaymentIntentExpired event to the household OWNER. The read + flip share
 * a transaction so the returned set is exactly the flipped set.
 */
export async function expireStaleDrafts(now: Date) {
  return prisma.$transaction(async (tx) => {
    const stale = await tx.paymentIntent.findMany({
      where: { status: "DRAFT", expiresAt: { lte: now } },
      select: {
        id: true,
        householdId: true,
        expiresAt: true,
        household: {
          select: { members: { select: { userId: true, role: true } } },
        },
      },
    })
    if (stale.length > 0) {
      await tx.paymentIntent.updateMany({
        where: { id: { in: stale.map((i) => i.id) } },
        data: { status: "EXPIRED" },
      })
    }
    return stale
  })
}

/** An intent + its recorded payment, household-scoped — the confirm path's read. */
export async function findIntentWithPayment(householdId: string, intentId: string) {
  return prisma.paymentIntent.findFirst({
    where: { id: intentId, householdId },
    select: {
      ...INTENT_SELECT,
      scheduledPayment: { select: { id: true } },
      card: { select: { id: true, cardName: true } },
    },
  })
}

/**
 * Record the ScheduledPayment for a complete draft and mark it SUBMITTED
 * — the idempotent record-only confirm (issue #45, EDR-010). The
 * `intentId @unique` constraint is the DB backstop: under a two-tab /
 * double-submit race every path lands on exactly one payment row. The
 * loser's recovery runs OUTSIDE the transaction — on Postgres a failed
 * statement aborts the enclosing transaction, so an in-tx P2002 catch
 * can never issue further statements (review finding); the pre-check
 * inside the tx handles the sequential re-confirm, the outer catch
 * handles the true concurrent race after rollback.
 */
export async function recordPaymentForIntent(intent: {
  id: string
  cardId: string
  fundingAccountId: string | null
  amountMinor: Minor
  scheduledFor: Date
  note: string | null
}): Promise<{ paymentId: string; alreadyRecorded: boolean }> {
  const markSubmitted = (client: Prisma.TransactionClient | typeof prisma) =>
    client.paymentIntent.updateMany({
      where: { id: intent.id, status: "DRAFT" },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    })
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.scheduledPayment.findUnique({
        where: { intentId: intent.id },
        select: { id: true },
      })
      if (existing) {
        await markSubmitted(tx)
        return { paymentId: existing.id, alreadyRecorded: true }
      }
      const payment = await tx.scheduledPayment.create({
        data: {
          cardId: intent.cardId,
          fundingAccountId: intent.fundingAccountId,
          intentId: intent.id,
          amountMinor: intent.amountMinor,
          scheduledFor: intent.scheduledFor,
          note: intent.note,
        },
        select: { id: true },
      })
      await markSubmitted(tx)
      return { paymentId: payment.id, alreadyRecorded: false }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Lost the concurrent insert race: the winner committed. The aborted
      // transaction has rolled back; recover on a fresh connection.
      const existing = await prisma.scheduledPayment.findUnique({
        where: { intentId: intent.id },
        select: { id: true },
      })
      if (existing) {
        await markSubmitted(prisma)
        return { paymentId: existing.id, alreadyRecorded: true }
      }
    }
    throw error
  }
}

/**
 * Move a SCHEDULED payment to a new date within the caller's household
 * (issue #44). Only unresolved rows move — DONE/SKIPPED/CANCELED are
 * history (EDR-010) and match zero rows here, same as a cross-household
 * or missing id. Returns the prior date + card identity for the audit
 * event; read + update share a transaction so the audit's fromDate is
 * the date the update actually replaced (review finding).
 */
export async function rescheduleScheduledPayment(
  householdId: string,
  paymentId: string,
  scheduledFor: Date
): Promise<{ updated: number; previousFor: Date | null; cardId: string | null; cardName: string | null }> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.scheduledPayment.findFirst({
      where: { id: paymentId, status: "SCHEDULED", card: { householdId } },
      select: { scheduledFor: true, card: { select: { id: true, cardName: true } } },
    })
    const result = await tx.scheduledPayment.updateMany({
      where: { id: paymentId, status: "SCHEDULED", card: { householdId } },
      data: { scheduledFor },
    })
    return {
      updated: result.count,
      previousFor: before?.scheduledFor ?? null,
      cardId: before?.card.id ?? null,
      cardName: before?.card.cardName ?? null,
    }
  })
}
