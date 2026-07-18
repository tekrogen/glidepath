import { daysUntil, occurrencesInWindow } from "./days"
import type { Minor } from "./money"
import type { FinanceCard } from "./types"
import { utilization } from "./utilization"

/** Wireframe 1c: "NEXT 45 DAYS". */
export const RUNWAY_HORIZON_DAYS = 45
export const RUNWAY_WEEK_DAYS = 7

/** Runway needs the day-of-month anchors that FinanceCard deliberately omits. */
export interface RunwayCard extends FinanceCard {
  paymentDueDay: number | null
  statementCloseDay: number | null
}

/** A ScheduledPayment row reduced to what the projection needs. */
export interface RunwayPayment {
  id: string
  cardId: string
  amountMinor: Minor
  scheduledFor: Date
  status: "SCHEDULED" | "DONE" | "SKIPPED" | "CANCELED"
}

export interface RunwayEvent {
  cardId: string
  date: Date
  daysFromToday: number
  kind: "due" | "close" | "scheduled"
  /**
   * due: the card's recorded minimum (null = unknown, renders amount-less);
   * scheduled: the payment amount; close: always null (informational chip).
   */
  amountMinor: Minor | null
  /** due only: a SCHEDULED payment for this card covers this occurrence. */
  covered?: boolean
  /** scheduled only: the ScheduledPayment row id. */
  paymentId?: string
}

export interface RunwayLane {
  cardId: string
  balanceMinor: Minor
  utilization: number | null
  /** All of this card's events in the window, date-ascending. */
  events: RunwayEvent[]
}

export interface RunwayWeekBucket {
  /** 0-based; week n covers daysFromToday [7n, 7n + 7). */
  index: number
  startsOn: Date
  cashNeededMinor: Minor
}

export interface RunwayAggregate {
  horizonDays: number
  /** Exclusive end of the window (today + horizonDays). */
  horizonEnd: Date
  /** One lane per input card, input order preserved (the page owns sorting). */
  lanes: RunwayLane[]
  weeks: RunwayWeekBucket[]
  totalCashNeededMinor: Minor
}

/**
 * Runway lane projection over the horizon (Blueprint Level 2: "lane
 * projection over horizon; weekly cash buckets; totals").
 *
 * Events per lane: every due-day and close-day occurrence in the window
 * (a 45-day horizon can hold two of each) plus unresolved SCHEDULED
 * payments. The by-due/by-close toggle is presentation — both kinds are
 * always emitted; the page (#44) chooses emphasis.
 *
 * Cash-needed rule (deterministic, disclosed in UI): each SCHEDULED
 * payment contributes its amount on its date; each due occurrence NOT
 * covered by a payment contributes the card's recorded minimum (unknown
 * minimum → contributes nothing). A payment covers the first uncovered
 * due occurrence on or after its date, matched greedily per card — one
 * payment never covers two dues. Close events never contribute cash.
 */
export function runwayAggregate(
  cards: RunwayCard[],
  payments: RunwayPayment[],
  today: Date,
  horizonDays: number = RUNWAY_HORIZON_DAYS
): RunwayAggregate {
  const horizonEnd = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + horizonDays)
  )

  const weekCount = Math.ceil(horizonDays / RUNWAY_WEEK_DAYS)
  const weeks: RunwayWeekBucket[] = Array.from({ length: weekCount }, (_, index) => ({
    index,
    startsOn: new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + index * RUNWAY_WEEK_DAYS
      )
    ),
    cashNeededMinor: 0n,
  }))

  let totalCashNeededMinor = 0n
  const addCash = (daysFromToday: number, amount: Minor) => {
    weeks[Math.floor(daysFromToday / RUNWAY_WEEK_DAYS)].cashNeededMinor += amount
    totalCashNeededMinor += amount
  }

  const lanes: RunwayLane[] = cards.map((card) => {
    const events: RunwayEvent[] = []

    const active = payments
      .filter((p) => p.cardId === card.id && p.status === "SCHEDULED")
      .map((p) => ({ payment: p, delta: daysUntil(p.scheduledFor, today) }))
      .filter(({ delta }) => delta >= 0 && delta < horizonDays)
      .sort((a, b) => a.delta - b.delta)

    for (const { payment, delta } of active) {
      events.push({
        cardId: card.id,
        date: payment.scheduledFor,
        daysFromToday: delta,
        kind: "scheduled",
        amountMinor: payment.amountMinor,
        paymentId: payment.id,
      })
      addCash(delta, payment.amountMinor)
    }

    if (card.paymentDueDay != null) {
      // Greedy cover: each payment claims the first due on/after its date.
      const unclaimed = active.map(({ delta }) => delta)
      for (const due of occurrencesInWindow(card.paymentDueDay, today, horizonDays)) {
        const delta = daysUntil(due, today)
        const claimIdx = unclaimed.findIndex((paymentDelta) => paymentDelta <= delta)
        const covered = claimIdx !== -1
        if (covered) unclaimed.splice(claimIdx, 1)
        events.push({
          cardId: card.id,
          date: due,
          daysFromToday: delta,
          kind: "due",
          amountMinor: card.minimumPaymentMinor,
          covered,
        })
        if (!covered && card.minimumPaymentMinor != null) {
          addCash(delta, card.minimumPaymentMinor)
        }
      }
    }

    if (card.statementCloseDay != null) {
      for (const close of occurrencesInWindow(card.statementCloseDay, today, horizonDays)) {
        events.push({
          cardId: card.id,
          date: close,
          daysFromToday: daysUntil(close, today),
          kind: "close",
          amountMinor: null,
        })
      }
    }

    events.sort((a, b) => a.daysFromToday - b.daysFromToday)
    return {
      cardId: card.id,
      balanceMinor: card.balanceMinor,
      utilization: utilization(card.balanceMinor, card.limitMinor),
      events,
    }
  })

  return { horizonDays, horizonEnd, lanes, weeks, totalCashNeededMinor }
}
