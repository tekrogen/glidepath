/**
 * Payment-reminder builder (issue #46) — turns the runway projection into
 * notification occurrences for the #25 occurrence-lifecycle store:
 *
 * - DUE_SOON: every uncovered due occurrence within the DUE_SOON window,
 *   per occurrence (the attention feed is precedence-capped to one alert
 *   per card; the notification store is not). dedupeKeys use the attention
 *   builder's exact shape, so the union with attention items dedupes —
 *   attention wins shared keys.
 * - PAYMENT_REMINDER: an imminent SCHEDULED payment the user planned.
 *
 * Coverage rule: a claiming scheduled payment (the engine's covered flag)
 * OR confirmed provider autopay (EDR-016) silences the due reminder.
 * Pure formatting over engine output — no derivation here (EDR-003/019).
 */
import {
  runwayAggregate,
  type RunwayCard,
  type RunwayPayment,
} from "@/lib/finance"
import { DUE_SOON_DAYS } from "@/features/cards/utils/card-status"
import { formatMinor, formatShortDate } from "@/lib/formatting"

/** How close a planned payment gets before it reminds — closer than the
 *  due window on purpose: the user scheduled it themselves. */
export const PAYMENT_REMINDER_LEAD_DAYS = 3

export interface ReminderCard extends RunwayCard {
  cardName: string
  lastFour: string | null
  autopayActive: boolean
}

export interface ReminderItem {
  type: "DUE_SOON" | "PAYMENT_REMINDER"
  entityRef: string
  dedupeKey: string
  title: string
  body: string
  href: string
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const label = (card: Pick<ReminderCard, "cardName" | "lastFour">) =>
  card.lastFour ? `${card.cardName} ····${card.lastFour}` : card.cardName

export function buildReminderItems(
  cards: ReminderCard[],
  payments: RunwayPayment[],
  today: Date
): ReminderItem[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const items: ReminderItem[] = []

  const { lanes } = runwayAggregate(cards, payments, today)
  for (const lane of lanes) {
    const card = byId.get(lane.cardId)
    if (!card || card.autopayActive) continue
    for (const event of lane.events) {
      if (event.kind !== "due" || event.covered) continue
      if (event.daysFromToday > DUE_SOON_DAYS) continue
      const minimum =
        card.minimumPaymentMinor != null
          ? ` Minimum ${formatMinor(card.minimumPaymentMinor)}.`
          : ""
      items.push({
        type: "DUE_SOON",
        entityRef: `card:${card.id}`,
        dedupeKey: `DUE_SOON:card:${card.id}:${isoDate(event.date)}`,
        title: "Payment due soon",
        body: `${label(card)} — payment due ${formatShortDate(event.date)} (${event.daysFromToday}d).${minimum}`,
        href: "/payments",
      })
    }
  }

  for (const payment of payments) {
    if (payment.status !== "SCHEDULED") continue
    const card = byId.get(payment.cardId)
    if (!card) continue
    const lane = lanes.find((l) => l.cardId === payment.cardId)
    const event = lane?.events.find((e) => e.kind === "scheduled" && e.paymentId === payment.id)
    if (!event || event.daysFromToday > PAYMENT_REMINDER_LEAD_DAYS) continue
    const when = event.daysFromToday === 0 ? "today" : event.daysFromToday === 1 ? "tomorrow" : `in ${event.daysFromToday} days`
    items.push({
      type: "PAYMENT_REMINDER",
      entityRef: `card:${card.id}`,
      dedupeKey: `PAYMENT_REMINDER:payment:${payment.id}:${isoDate(payment.scheduledFor)}`,
      title: `Planned payment ${when}`,
      body: `${label(card)} — you planned ${formatMinor(payment.amountMinor)} on ${formatShortDate(payment.scheduledFor)}.`,
      href: "/payments",
    })
  }

  return items
}
