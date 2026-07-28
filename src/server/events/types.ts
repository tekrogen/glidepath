/**
 * Domain events — the seam mutations publish through (issue #26).
 * A union of one today; each phase adds members, never a queue.
 */
export type DomainEvent =
  | {
      type: "CardAdded"
      userId: string
      householdId: string
      cardId: string
      cardName: string
    }
  | {
      type: "CardFrozen"
      userId: string
      householdId: string
      cardId: string
      cardName: string
    }
  | {
      type: "CardUnfrozen"
      userId: string
      householdId: string
      cardId: string
      cardName: string
    }
  | {
      type: "CardUpdated"
      userId: string
      householdId: string
      cardId: string
      cardName: string
      /** Form-field names whose values changed — the audit's what, not the values. */
      changedFields: string[]
    }
  | {
      type: "CardDeleted"
      userId: string
      householdId: string
      cardId: string
      cardName: string
      /** Restrict-FK rows removed with the card (issue #47/#57 — explicit
       *  audited removal, a recorded deviation from the blueprint's
       *  archive-first CardArchived model, per Marti 2026-07-25). */
      removedScheduledPayments: number
      removedStatements: number
      removedAutopayLink: boolean
    }
  | {
      type: "TrackerImported"
      userId: string
      householdId: string
      householdName: string
      created: number
      updated: number
      removed: number
      cardCount: number
    }
  | {
      type: "MonarchBalancesImported"
      userId: string
      householdId: string
      /** yyyy-mm-dd — the export's newest data date. */
      asOfDate: string
      updated: number
      changed: number
      mappingsSaved: number
      skippedAccounts: number
      unmatchedAccounts: number
    }
  | {
      type: "PaymentRescheduled"
      userId: string
      householdId: string
      cardId: string
      cardName: string
      paymentId: string
      /** ISO dates (yyyy-mm-dd) — the move the audit trail records. */
      fromDate: string
      toDate: string
    }
  | {
      type: "PaymentScheduled"
      userId: string
      householdId: string
      cardId: string
      cardName: string
      paymentId: string
      intentId: string
      /** Number cents + ISO date — event payloads are JSON (no bigint). */
      amountCents: number
      scheduledFor: string
    }
  | {
      type: "PaymentIntentExpired"
      /** The household OWNER's user (cron acts on the household's behalf). */
      userId: string
      householdId: string
      intentId: string
      /** ISO timestamp the draft expired at. */
      expiredAt: string
    }
  | {
      type: "PlaidCardsLinked"
      userId: string
      householdId: string
      plaidItemId: string
      institutionName: string | null
      cardIds: string[]
      cardNames: string[]
    }
  | {
      type: "PlaidLiabilitiesSynced"
      /** The linking user (webhook syncs act on the item owner's behalf). */
      userId: string
      householdId: string
      plaidItemId: string
      cardsUpdated: number
      suggestionsCreated: number
    }
  | {
      type: "CardSuggestionResolved"
      userId: string
      householdId: string
      cardId: string
      cardName: string
      /** SuggestedCardField name — the audit's what, values live on the row. */
      field: string
      resolution: "accepted" | "dismissed"
    }
