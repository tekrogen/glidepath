/**
 * Plaid occurrence builder (issue #109) — surfaces the two Liabilities-epic
 * conditions in the #25 occurrence-lifecycle store:
 *
 * - CARD_DISCOVERED: one occurrence per Plaid item with unimported
 *   credit-subtype accounts. Un-dated dedupeKey — persists (and honors a
 *   dismissal) until the accounts are imported or disconnected; the body
 *   refreshes as counts change.
 * - PROVIDER_MISMATCH: one occurrence per card with PENDING provider
 *   suggestions — persists until the user accepts or dismisses them all.
 *
 * Pure formatting over service DTOs — no derivation here (EDR-003/019).
 */
import type {
  DiscoveredCardDTO,
  SuggestionDTO,
} from "@/features/cards/server/plaid-cards-service"

export interface PlaidNotificationItem {
  type: "CARD_DISCOVERED" | "PROVIDER_MISMATCH"
  entityRef: string
  dedupeKey: string
  title: string
  body: string
  href: string
}

export function buildPlaidItems(
  discovered: DiscoveredCardDTO[],
  suggestions: SuggestionDTO[]
): PlaidNotificationItem[] {
  const items: PlaidNotificationItem[] = []

  const byItem = new Map<string, DiscoveredCardDTO[]>()
  for (const d of discovered) {
    const list = byItem.get(d.plaidItemId) ?? []
    list.push(d)
    byItem.set(d.plaidItemId, list)
  }
  for (const [plaidItemId, list] of byItem) {
    const institution = list[0].institutionName
    items.push({
      type: "CARD_DISCOVERED",
      entityRef: `plaiditem:${plaidItemId}`,
      dedupeKey: `CARD_DISCOVERED:plaiditem:${plaidItemId}`,
      title: "Credit cards discovered",
      body:
        list.length === 1
          ? `1 credit account at ${institution} can be imported as a card.`
          : `${list.length} credit accounts at ${institution} can be imported as cards.`,
      href: "/cards/import?source=plaid",
    })
  }

  const byCard = new Map<string, SuggestionDTO[]>()
  for (const s of suggestions) {
    const list = byCard.get(s.cardId) ?? []
    list.push(s)
    byCard.set(s.cardId, list)
  }
  for (const [cardId, list] of byCard) {
    items.push({
      type: "PROVIDER_MISMATCH",
      entityRef: `card:${cardId}`,
      dedupeKey: `PROVIDER_MISMATCH:card:${cardId}`,
      title: "Provider values differ",
      body:
        list.length === 1
          ? `Plaid reports a different value than you recorded on ${list[0].cardName} — review the suggestion.`
          : `Plaid reports ${list.length} values that differ from your entries on ${list[0].cardName} — review the suggestions.`,
      href: "/cards",
    })
  }

  return items
}
