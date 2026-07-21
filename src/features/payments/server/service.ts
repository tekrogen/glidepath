/**
 * Payments service — assembles the Payment Runway inputs and owns the
 * reschedule rule (issue #44). Business rules live here and in
 * lib/finance; repositories own Prisma; pages/queries own auth context
 * (arch doc §15). Record-only (EDR-010): rescheduling moves a tracked
 * row's date — nothing here touches a real payment.
 */
import {
  daysUntil,
  RUNWAY_HORIZON_DAYS,
  type RunwayCard,
  type RunwayPayment,
} from "@/lib/finance"
import {
  findHouseholdCards,
  findHouseholdIdForUser,
} from "@/features/cards/server/repository"
import type { Lifecycle } from "@/features/cards/utils/card-status"
import { emitDomainEvent } from "@/server/events/publishers"

import { toRunwayCard, toRunwayPayment } from "./mappers"
import { findScheduledPayments, rescheduleScheduledPayment } from "./repository"

/** A runway lane's card: engine shape + what the lane label renders. */
export interface RunwayPageCard extends RunwayCard {
  cardName: string
  lifecycle: Lifecycle
}

export interface PaymentRunway {
  cards: RunwayPageCard[]
  payments: RunwayPayment[]
  /** The clock every derived figure was computed with — the page and the
   *  client recompute against this, never a fresh Date. */
  asOf: Date
}

/** Everything the runway page needs; empty when the user has no household. */
export async function getPaymentRunway(userId: string, today = new Date()): Promise<PaymentRunway> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) {
    return { cards: [], payments: [], asOf: today }
  }
  const [rows, paymentRows] = await Promise.all([
    findHouseholdCards(householdId),
    findScheduledPayments(householdId),
  ])
  const cards = rows.map((row) => ({
    ...toRunwayCard(row),
    cardName: row.cardName,
    lifecycle: row.lifecycle as Lifecycle,
  }))
  return {
    cards,
    payments: paymentRows.map(toRunwayPayment),
    asOf: today,
  }
}

/** Thrown for date-rule violations so the action can answer with a specific message. */
export class RescheduleDateError extends Error {
  constructor(public readonly rule: "past" | "beyond-horizon") {
    super(`reschedule date rejected: ${rule}`)
  }
}

/**
 * Move a SCHEDULED payment to a new date (issue #44). The date must sit
 * inside the runway window [today, today + 45): the window starts today
 * (back-dating records an intent that can no longer happen), and the
 * lane board is the only surface that can show or move the row — a date
 * beyond the horizon would strand it out of reach (review finding). A
 * cross-household, missing, or already-resolved id updates zero rows and
 * throws; the action maps that to a failure result. Audited through the
 * events seam.
 */
export async function reschedulePaymentForUser(
  userId: string,
  paymentId: string,
  scheduledFor: Date,
  today = new Date()
): Promise<{ scheduledFor: Date }> {
  const days = daysUntil(scheduledFor, today)
  if (days < 0) throw new RescheduleDateError("past")
  if (days >= RUNWAY_HORIZON_DAYS) throw new RescheduleDateError("beyond-horizon")
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")
  const { updated, previousFor, cardId, cardName } = await rescheduleScheduledPayment(
    householdId,
    paymentId,
    scheduledFor
  )
  if (updated === 0) throw new Error("Not authorized")
  await emitDomainEvent({
    type: "PaymentRescheduled",
    userId,
    householdId,
    cardId: cardId ?? "unknown",
    cardName: cardName ?? "Card",
    paymentId,
    fromDate: previousFor ? previousFor.toISOString().slice(0, 10) : "unknown",
    toDate: scheduledFor.toISOString().slice(0, 10),
  })
  return { scheduledFor }
}
