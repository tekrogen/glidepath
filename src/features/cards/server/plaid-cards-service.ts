/**
 * Plaid → card-domain business rules (issue #109): the discovered-cards
 * import and the provider-suggestion review. Sits beside the tracker/Monarch
 * import modules; the repository owns Prisma, liabilities-sync owns the
 * provider pull, DTOs cross the RSC boundary as plain numbers (no bigint).
 */
import { emitDomainEvent } from "@/server/events/publishers"

import { syncLiabilitiesForItem } from "./liabilities-sync"
import {
  createDiscoveredCards,
  findDiscoveredCreditAccounts,
  findHouseholdIdForUser,
  findOrCreateHouseholdForUser,
  findPendingSuggestions,
  resolveSuggestion,
  type DiscoveredCardCreate,
} from "./repository"
import { issuerKeyFor, normalizeLastFour, toMinor } from "./tracker-import"

export interface DiscoveredCardDTO {
  plaidAccountId: string
  plaidItemId: string
  name: string
  institutionName: string
  /** Display mask ("...3333") or null — presentation only, never identity. */
  maskLabel: string | null
  balanceCents: number
  currency: string
}

export async function getDiscoveredCardsForUser(
  userId: string
): Promise<DiscoveredCardDTO[]> {
  const rows = await findDiscoveredCreditAccounts(userId)
  return rows.map((row) => ({
    plaidAccountId: row.id,
    plaidItemId: row.plaidItem.id,
    name: row.userAccount?.name ?? row.name ?? "Credit account",
    institutionName: row.plaidItem.institutionName ?? "Connected institution",
    maskLabel: row.mask ? `...${row.mask}` : null,
    balanceCents: Math.max(0, Math.round(Number(row.userAccount?.balance ?? 0) * 100)),
    currency: row.userAccount?.currency ?? "USD",
  }))
}

export interface ImportDiscoveredResult {
  created: { cardId: string; cardName: string }[]
  skipped: number
  liabilities: { cardsUpdated: number; suggestionsOpened: number; failedItems: number }
}

/**
 * Import the selected discovered accounts as cards, then pull liabilities per
 * item to fill APR/minimum/due-day/statement fields (SYNC_PENDING → SYNCED).
 * A liabilities failure never fails the import — those cards sweep to
 * SYNC_FAILED and surface through the existing attention engine.
 */
export async function importDiscoveredCardsForUser(
  userId: string,
  plaidAccountIds: string[]
): Promise<ImportDiscoveredResult> {
  const householdId = await findOrCreateHouseholdForUser(userId)
  const candidates = await findDiscoveredCreditAccounts(userId)
  const wanted = new Set(plaidAccountIds)
  const selected = candidates.filter((c) => wanted.has(c.id))

  const creates: DiscoveredCardCreate[] = selected.map((c) => {
    const issuer = c.plaidItem.institutionName ?? "Connected institution"
    const balance = Number(c.userAccount?.balance ?? 0)
    return {
      plaidAccountId: c.id,
      cardName: c.userAccount?.name ?? c.name ?? `${issuer} card`,
      issuer,
      issuerKey: issuerKeyFor(issuer),
      lastFour: normalizeLastFour(c.mask).lastFour,
      currency: c.userAccount?.currency ?? "USD",
      currentBalanceMinor: balance > 0 ? toMinor(balance) : 0n,
    }
  })

  const created = await createDiscoveredCards(userId, householdId, creates)

  // Audit the link per item, then fill from Liabilities per item.
  const byItem = new Map<string, { cardId: string; cardName: string }[]>()
  for (const row of created) {
    const list = byItem.get(row.plaidItemId) ?? []
    list.push({ cardId: row.cardId, cardName: row.cardName })
    byItem.set(row.plaidItemId, list)
  }

  const institutionByItem = new Map(
    selected.map((c) => [c.plaidItem.id, c.plaidItem.institutionName ?? null])
  )

  let cardsUpdated = 0
  let suggestionsOpened = 0
  let failedItems = 0
  for (const [plaidItemId, cards] of byItem) {
    await emitDomainEvent({
      type: "PlaidCardsLinked",
      userId,
      householdId,
      plaidItemId,
      institutionName: institutionByItem.get(plaidItemId) ?? null,
      cardIds: cards.map((c) => c.cardId),
      cardNames: cards.map((c) => c.cardName),
    })
    try {
      const result = await syncLiabilitiesForItem(plaidItemId, { userId })
      cardsUpdated += result.cardsUpdated
      suggestionsOpened += result.suggestionsOpened
    } catch {
      // Already logged + swept to SYNC_FAILED inside the sync.
      failedItems++
    }
  }

  return {
    created: created.map(({ cardId, cardName }) => ({ cardId, cardName })),
    skipped: selected.length - created.length,
    liabilities: { cardsUpdated, suggestionsOpened, failedItems },
  }
}

export interface SuggestionDTO {
  id: string
  cardId: string
  cardName: string
  field: "REGULAR_APR_BPS" | "CREDIT_LIMIT_MINOR" | "MINIMUM_PAYMENT_MINOR" | "PAYMENT_DUE_DAY"
  proposedValue: string
  currentValue: string | null
}

export async function getPendingSuggestionsForUser(
  userId: string
): Promise<SuggestionDTO[]> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) return []
  const rows = await findPendingSuggestions(householdId)
  return rows.map((row) => ({
    id: row.id,
    cardId: row.card.id,
    cardName: row.card.cardName,
    field: row.field,
    proposedValue: row.proposedValue,
    currentValue: row.currentValue,
  }))
}

export async function resolveSuggestionForUser(
  userId: string,
  suggestionId: string,
  resolution: "accepted" | "dismissed"
): Promise<"ok" | "not-found"> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) return "not-found"
  const resolved = await resolveSuggestion(householdId, suggestionId, resolution)
  if (!resolved) return "not-found"
  await emitDomainEvent({
    type: "CardSuggestionResolved",
    userId,
    householdId,
    cardId: resolved.cardId,
    cardName: resolved.cardName,
    field: resolved.field,
    resolution,
  })
  return "ok"
}
