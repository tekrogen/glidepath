/**
 * Domain events — the seam mutations publish through (issue #26).
 * A union of one today; each phase adds members, never a queue.
 */
export type DomainEvent = {
  type: "CardAdded"
  userId: string
  householdId: string
  cardId: string
  cardName: string
}
