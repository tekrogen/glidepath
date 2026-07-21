/**
 * Payments repository — the only module that touches Prisma for the
 * payments domain (arch doc §15). Card rows come from the cards
 * repository (that domain owns them); this one owns ScheduledPayment.
 * Authorization is the household id in the WHERE (EDR-014): a
 * cross-household id matches zero rows — no separate existence read,
 * no TOCTOU.
 */
import { prisma } from "@/lib/db/prisma"

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
