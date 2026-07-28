/**
 * Liabilities sync commit (issue #109) — the I/O half of liabilities-plan.ts.
 *
 * Pulls the item's liabilities through the Plaid layer, joins them to linked
 * cards through the PlaidAccount spine (accountId only — never masks), runs
 * the pure planner per card, and applies each plan through the repository.
 * Callers: the discovered-cards confirm action (inline), the sync-now route,
 * and the LIABILITIES:DEFAULT_UPDATE webhook dispatch.
 *
 * Failure contract: any thrown error first sweeps the item's linked cards to
 * SYNC_FAILED (feeding the existing attention engine), then rethrows for the
 * caller's own handling.
 */
import { getLiabilitiesForItem, sanitizePlaidError } from "@/lib/services/plaid-service"
import { emitDomainEvent } from "@/server/events/publishers"

import {
  normalizeCreditLiability,
  planLiabilityApply,
  type FieldProvenance,
} from "./liabilities-plan"
import {
  applyLiabilityPlan,
  findPlaidLinkedCards,
  markPlaidCardsSyncStatus,
} from "./repository"

export interface LiabilitiesSyncResult {
  cardsUpdated: number
  suggestionsOpened: number
  warnings: string[]
}

export async function syncLiabilitiesForItem(
  plaidItemId: string,
  actor: { userId: string }
): Promise<LiabilitiesSyncResult> {
  const linked = await findPlaidLinkedCards(plaidItemId)
  if (linked.length === 0) {
    return { cardsUpdated: 0, suggestionsOpened: 0, warnings: [] }
  }

  try {
    const { accounts, credit } = await getLiabilitiesForItem(plaidItemId)
    const accountById = new Map(accounts.map((a) => [a.account_id, a]))
    const syncedAt = new Date()

    let cardsUpdated = 0
    let suggestionsOpened = 0
    const warnings: string[] = []
    const syncedCardIds = new Set<string>()

    for (const link of linked) {
      const card = link.creditCard
      if (!card) continue
      const liability = credit.find((c) => c.account_id === link.accountId)
      if (!liability) {
        warnings.push(`no liability data for linked account ${link.accountId}`)
        continue
      }

      const normalized = normalizeCreditLiability(
        liability,
        accountById.get(link.accountId)
      )
      const plan = planLiabilityApply(
        {
          currency: card.currency,
          regularAprBps: card.regularAprBps,
          aprSource: card.aprSource as FieldProvenance,
          creditLimitMinor: card.creditLimitMinor,
          limitSource: card.limitSource as FieldProvenance,
          minimumPaymentMinor: card.minimumPaymentMinor,
          minimumSource: card.minimumSource as FieldProvenance,
          paymentDueDay: card.paymentDueDay,
          dueDaySource: card.dueDaySource as FieldProvenance,
          hasActivePromo: card.promoPeriods.length > 0,
        },
        normalized
      )

      const applied = await applyLiabilityPlan(card.id, plan, syncedAt)
      syncedCardIds.add(card.id)
      cardsUpdated++
      suggestionsOpened += applied.suggestionsOpened
      warnings.push(...plan.warnings)
    }

    // Linked cards Plaid returned no liability row for still had a successful
    // sync pass — stamp them SYNCED so SYNC_PENDING never sticks.
    if (syncedCardIds.size < linked.length) {
      await markPlaidCardsSyncStatus(plaidItemId, "SYNCED", syncedAt)
    }

    const householdId = linked[0]?.creditCard?.householdId
    if (householdId) {
      await emitDomainEvent({
        type: "PlaidLiabilitiesSynced",
        userId: actor.userId,
        householdId,
        plaidItemId,
        cardsUpdated,
        suggestionsCreated: suggestionsOpened,
      })
    }

    return { cardsUpdated, suggestionsOpened, warnings }
  } catch (error) {
    console.error(
      "[Plaid] liabilities sync failed:",
      sanitizePlaidError(error)
    )
    await markPlaidCardsSyncStatus(plaidItemId, "SYNC_FAILED").catch(() => {
      // Best-effort status sweep — the rethrow below carries the real error.
    })
    throw error
  }
}
