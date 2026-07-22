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
