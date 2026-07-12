/**
 * Upcoming-payments builder (issue #12) — the real "Upcoming payments" widget
 * feed. Pure derivation over figures already on the portfolio: the next due
 * date comes from the single due-day owner (nextDueDate), the minimum is the
 * recorded actual (never an estimate — no ~). No new math here.
 */
import { nextDueDate } from "@/features/cards/utils/due-dates"
import type { PortfolioCard } from "@/features/cards/server/service"

export interface UpcomingPayment {
  cardId: string
  cardName: string
  /** Never keyed on — display only (real portfolios contain duplicates). */
  lastFour: string | null
  /** Next occurrence of the card's due day on/after `asOf`. */
  dueDate: Date
  dueInDays: number | null
  /** Recorded minimum (bigint minor units); null when not set. Serialize at
   *  the RSC boundary before it reaches any client component. */
  minimumPaymentMinor: bigint | null
}

/**
 * One row per non-archived card that has a known due day, sorted by soonest
 * due date then card name. `asOf` is the single clock (never a fresh Date) —
 * the same instant every other Overview figure was computed with.
 */
export function buildUpcomingPayments(cards: PortfolioCard[], asOf: Date): UpcomingPayment[] {
  const items: UpcomingPayment[] = []
  for (const card of cards) {
    if (card.lifecycle === "ARCHIVED") continue
    if (card.paymentDueDay == null) continue
    const dueDate = nextDueDate(card.paymentDueDay, asOf)
    if (dueDate == null) continue
    items.push({
      cardId: card.id,
      cardName: card.cardName,
      lastFour: card.lastFour,
      dueDate,
      dueInDays: card.dueInDays,
      minimumPaymentMinor: card.finance.minimumPaymentMinor,
    })
  }
  return items.sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.cardName.localeCompare(b.cardName)
  )
}
