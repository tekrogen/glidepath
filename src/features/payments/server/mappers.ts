/**
 * Boundary mappers: Prisma rows → lib/finance runway inputs. No
 * calculator ever touches the ORM (EDR-019). Card mapping delegates to
 * the cards feature's toFinanceCard and adds the day-of-month anchors
 * FinanceCard deliberately omits.
 */
import type { RunwayCard, RunwayPayment } from "@/lib/finance"
import { toFinanceCard, type CardRowLike } from "@/features/cards/server/mappers"

/** The card row shape the runway mapper accepts — CardRowLike + the anchors. */
export interface RunwayCardRowLike extends CardRowLike {
  paymentDueDay: number | null
  statementCloseDay: number | null
}

export function toRunwayCard(row: RunwayCardRowLike): RunwayCard {
  return {
    ...toFinanceCard(row),
    paymentDueDay: row.paymentDueDay,
    statementCloseDay: row.statementCloseDay,
  }
}

/** The payment row shape the mapper accepts — matches Prisma ScheduledPayment. */
export interface ScheduledPaymentRowLike {
  id: string
  cardId: string
  amountMinor: bigint
  scheduledFor: Date
  status: "SCHEDULED" | "DONE" | "SKIPPED" | "CANCELED"
}

export function toRunwayPayment(row: ScheduledPaymentRowLike): RunwayPayment {
  return {
    id: row.id,
    cardId: row.cardId,
    amountMinor: row.amountMinor,
    scheduledFor: row.scheduledFor,
    status: row.status,
  }
}
