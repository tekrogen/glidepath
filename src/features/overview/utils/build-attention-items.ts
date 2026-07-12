/**
 * Attention builder (issue #25) — turns the portfolio's already-resolved
 * alerts into display-ready attention items. Pure formatting over figures
 * computed upstream (card-status engine + lib/finance): deriving an alert
 * here would be a second derivation path, a review-blocking defect (EDR-003).
 */
import { daysUntil } from "@/lib/finance"
import { formatMinor, formatPercent, formatShortDate } from "@/lib/formatting"
import { nextDueDate } from "@/features/cards/utils/due-dates"
import type { PortfolioCard } from "@/features/cards/server/service"

export type AttentionType =
  | "PROMO_EXPIRED"
  | "PROMO_ENDING_SOON"
  | "HIGH_UTILIZATION"
  | "DUE_SOON"
  | "SYNC_FAILED"

export interface AttentionItem {
  type: AttentionType
  cardId: string
  /** `card:<id>` — never a lastFour (real portfolios contain duplicates). */
  entityRef: string
  /** Stable occurrence identity — controls re-notification (see dedupe rules). */
  dedupeKey: string
  title: string
  body: string
  /** "/cards" for now — card detail arrives Phase 5. */
  href: string
  /** Ascending = more urgent. */
  priority: number
}

const PRIORITY: Record<AttentionType, number> = {
  PROMO_EXPIRED: 0,
  PROMO_ENDING_SOON: 1,
  HIGH_UTILIZATION: 2,
  DUE_SOON: 3,
  SYNC_FAILED: 4,
}

const HREF = "/cards"

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

const label = (card: PortfolioCard) =>
  card.lastFour ? `${card.cardName} ····${card.lastFour}` : card.cardName

function item(
  type: AttentionType,
  card: PortfolioCard,
  dedupeSuffix: string,
  title: string,
  body: string
): AttentionItem {
  return {
    type,
    cardId: card.id,
    entityRef: `card:${card.id}`,
    dedupeKey: `${type}:card:${card.id}${dedupeSuffix}`,
    title,
    body,
    href: HREF,
    priority: PRIORITY[type],
  }
}

/** The card's resolved alert as an attention item, or null when OK. */
function alertItem(card: PortfolioCard, today: Date): AttentionItem | null {
  const { finance } = card
  switch (card.alert) {
    case "PROMO_EXPIRED": {
      if (finance.promo == null) return null
      const { endsOn, shelteredBalanceMinor } = finance.promo
      return item(
        "PROMO_EXPIRED",
        card,
        `:${isoDate(endsOn)}`,
        "0% promo expired",
        `${label(card)} — 0% APR ended ${formatShortDate(endsOn)}. ~${formatMinor(shelteredBalanceMinor)} sheltered.`
      )
    }
    case "PROMO_ENDING_SOON": {
      if (finance.promo == null) return null
      const { endsOn, shelteredBalanceMinor } = finance.promo
      return item(
        "PROMO_ENDING_SOON",
        card,
        `:${isoDate(endsOn)}`,
        "0% promo ending soon",
        `${label(card)} — 0% APR ends ${formatShortDate(endsOn)} (${daysUntil(endsOn, today)}d). ~${formatMinor(shelteredBalanceMinor)} sheltered.`
      )
    }
    case "HIGH_UTILIZATION":
      return item(
        "HIGH_UTILIZATION",
        card,
        "",
        "High utilization",
        `${label(card)} — ${formatMinor(finance.balanceMinor)} balance is ${formatPercent(card.utilization)} of the ${formatMinor(finance.limitMinor ?? 0n)} limit.`
      )
    case "DUE_SOON": {
      const due = nextDueDate(card.paymentDueDay, today)
      if (due == null) return null
      const minimum =
        finance.minimumPaymentMinor != null
          ? ` Minimum ${formatMinor(finance.minimumPaymentMinor)}.`
          : ""
      return item(
        "DUE_SOON",
        card,
        `:${isoDate(due)}`,
        "Payment due soon",
        `${label(card)} — payment due ${formatShortDate(due)} (${daysUntil(due, today)}d).${minimum}`
      )
    }
    default:
      return null
  }
}

/**
 * One item per (card, condition). ARCHIVED cards are excluded; FROZEN cards
 * still surface promo/utilization items — lifecycle outranks alerts only for
 * the badge, not the attention feed (Blueprint worked example).
 */
export function buildAttentionItems(cards: PortfolioCard[], today: Date): AttentionItem[] {
  const entries: Array<{ cardName: string; item: AttentionItem }> = []
  for (const card of cards) {
    if (card.lifecycle === "ARCHIVED") continue
    const alert = alertItem(card, today)
    if (alert) entries.push({ cardName: card.cardName, item: alert })
    if (card.syncStatus === "SYNC_FAILED" || card.syncStatus === "DISCONNECTED") {
      entries.push({
        cardName: card.cardName,
        item: item(
          "SYNC_FAILED",
          card,
          "",
          "Sync needs attention",
          `${label(card)} — connection ${card.syncStatus === "DISCONNECTED" ? "is disconnected" : "sync failed"}; balances may be stale.`
        ),
      })
    }
  }
  return entries
    .sort((a, b) => a.item.priority - b.item.priority || a.cardName.localeCompare(b.cardName))
    .map((e) => e.item)
}
