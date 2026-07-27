/**
 * Monarch balances commit (issue #48) — ONE $transaction, update-only:
 * never creates cards, households, or members. Any failure aborts
 * everything, so the action's "nothing was changed" stays LITERALLY true.
 *
 * Race semantics: the @@unique([householdId, monarchAccountKey]) constraint
 * is the backstop — a concurrent import claiming the same account key for
 * a different card aborts this transaction on the constraint violation
 * rather than splitting a key across cards. In-tx duplicate guards run
 * first as the app-level check ahead of the DB.
 *
 * Takes a PrismaClient so a future CLI shares byte-identical writes with
 * the server action (the #28 pattern).
 */
import type { PrismaClient } from "@prisma/client"

export interface ResolvedMonarchUpdate {
  cardId: string
  /** Verbatim Monarch account string — persisted as the re-run match key. */
  accountKey: string
  /** "Positive owed" minor units (already negated + clamped upstream). */
  owedMinor: bigint
  /** The ACCOUNT's own latest date (not the file max) — what this balance is as of. */
  asOfDate: string
}

export interface MonarchImportCardOutcome {
  cardId: string
  cardName: string
  issuer: string
  lastFour: string | null
  accountKey: string
  beforeCents: number
  afterCents: number
  outcome: "changed" | "unchanged"
  mappingSaved: boolean
}

export interface MonarchImportResult {
  householdId: string
  updated: number
  changed: number
  mappingsSaved: number
  cards: MonarchImportCardOutcome[]
}

export async function commitMonarchImport(
  prisma: PrismaClient,
  updates: ResolvedMonarchUpdate[],
  opts: { userId: string }
): Promise<MonarchImportResult> {
  return prisma.$transaction(
    async (tx) => {
      // 1. The user's own membership household (EDR-014) — looked up, never created.
      const member = await tx.householdMember.findFirst({
        where: { userId: opts.userId },
        select: { householdId: true },
      })
      if (!member) throw new Error("Not authorized")
      const householdId = member.householdId

      // 3 (before 2 cheaply): app-level duplicate guards ahead of the DB constraint.
      const cardIds = updates.map((u) => u.cardId)
      const accountKeys = updates.map((u) => u.accountKey)
      if (new Set(cardIds).size !== cardIds.length) {
        throw new Error("Two accounts resolved to the same card")
      }
      if (new Set(accountKeys).size !== accountKeys.length) {
        throw new Error("Duplicate account keys in the update set")
      }

      // 2. Every target must exist IN THIS household — cross-household ids
      //    and cards deleted since the preview abort the whole transaction.
      const cards = await tx.creditCard.findMany({
        where: { id: { in: cardIds }, householdId },
        select: {
          id: true,
          cardName: true,
          issuer: true,
          lastFour: true,
          currency: true,
          currentBalanceMinor: true,
          monarchAccountKey: true,
        },
      })
      if (cards.length !== cardIds.length) {
        throw new Error("A card in the plan no longer exists in your household")
      }
      const byId = new Map(cards.map((c) => [c.id, c]))
      for (const u of updates) {
        if (byId.get(u.cardId)!.currency !== "USD") {
          throw new Error("A card in the plan is not USD-denominated")
        }
      }

      // 4. Clear EVERY current holder of a key in the update set — including
      //    cards that are themselves being updated (review finding: excluding
      //    them made a rebind/key-swap between two updated cards abort on the
      //    unique constraint). Each update rewrites its own key in step 5, so
      //    clearing first is always safe inside this transaction.
      await tx.creditCard.updateMany({
        where: { householdId, monarchAccountKey: { in: accountKeys } },
        data: { monarchAccountKey: null },
      })

      // 5. Per-card balance write + key persistence.
      const outcomes: MonarchImportCardOutcome[] = []
      let changed = 0
      let mappingsSaved = 0
      for (const u of updates) {
        const before = byId.get(u.cardId)!
        const isChanged = before.currentBalanceMinor !== u.owedMinor
        const mappingSaved = before.monarchAccountKey !== u.accountKey
        await tx.creditCard.update({
          where: { id: u.cardId },
          data: {
            currentBalanceMinor: u.owedMinor,
            monarchAccountKey: u.accountKey,
            // First-ever writer of CreditCard.lastSyncedAt (recorded in the
            // PR deviations list): the account's own as-of date, UTC midnight.
            lastSyncedAt: new Date(`${u.asOfDate}T00:00:00Z`),
          },
        })
        if (isChanged) changed++
        if (mappingSaved) mappingsSaved++
        outcomes.push({
          cardId: u.cardId,
          cardName: before.cardName,
          issuer: before.issuer,
          lastFour: before.lastFour,
          accountKey: u.accountKey,
          beforeCents: Number(before.currentBalanceMinor),
          afterCents: Number(u.owedMinor),
          outcome: isChanged ? "changed" : "unchanged",
          mappingSaved,
        })
      }

      return {
        householdId,
        updated: updates.length,
        changed,
        mappingsSaved,
        cards: outcomes,
      }
    },
    { timeout: 30_000 }
  )
}
