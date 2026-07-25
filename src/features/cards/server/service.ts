/**
 * Cards service — assembles the card portfolio for UI consumption.
 * Business rules live here and in lib/finance; the repository owns Prisma;
 * pages/queries own auth context (arch doc §15).
 */
import {
  paydownRank,
  portfolioSummary,
  promoPayoffPlans,
  runwayAggregate,
  utilization,
  type FinanceCard,
  type PortfolioSummary,
  type PromoPayoffPlan,
} from "@/lib/finance"
import { toRunwayCard, toRunwayPayment } from "@/features/payments/server/mappers"
// Repository-level import only (no service) — keeps the module graph acyclic.
import { findScheduledPayments } from "@/features/payments/server/repository"
import {
  resolveAlert,
  resolveStatusBadge,
  type Alert,
  type ConnectionState,
  type Lifecycle,
  type StatusBadge,
} from "@/features/cards/utils/card-status"
import { dueInDays } from "@/features/cards/utils/due-dates"
import type { CreateCardInput } from "@/features/cards/schemas/create-card-schema"
import type { EditCardInput } from "@/features/cards/schemas/edit-card-schema"
import { emitDomainEvent } from "@/server/events/publishers"

import { changedCardFields, toCreateCardData, toUpdateCardData } from "./create-card-data"
import { toFinanceCard } from "./mappers"
import {
  createCard,
  deleteCardWithDependents,
  findCardDependents,
  findHouseholdCards,
  findHouseholdIdForUser,
  findHouseholdMembers,
  findOrCreateHouseholdForUser,
  setCardLifecycle,
  updateCard,
  verifyHouseholdMember,
  type CardRow,
} from "./repository"

export interface PortfolioCard {
  id: string
  cardName: string
  lastFour: string | null
  issuer: string
  issuerKey: string | null
  ownerLabel: string | null // null ⇒ shared
  lifecycle: Lifecycle
  statusBadge: StatusBadge
  /** The resolved alert (pre-badge) — the attention feed reads this so the
   *  derivation stays single-sourced (EDR-003). */
  alert: Alert
  /** Aggregator linkage health — never the status badge, always an attention input. */
  syncStatus: ConnectionState
  utilization: number | null
  paydownPriority: number | null
  paymentDueDay: number | null
  /** Days until the next payment due date; null when no due day is known.
   *  Single-sourced from the alert engine's own input — no new math. */
  dueInDays: number | null
  /** Autopay or a claiming SCHEDULED payment covers the next due (issue #46). */
  dueCovered: boolean
  /** EDR-016 provider metadata: user confirmed autopay at the issuer. */
  autopayActive: boolean
  /** Issuer payment page for the PAY link-out; null when unrecorded. */
  autopayProviderUrl: string | null
  /** Finance shape for calculators / client-side what-if. */
  finance: FinanceCard
  /** Provenance: true when a displayed derived figure rests on unconfirmed inputs. */
  hasEstimatedInputs: boolean
  /** Edit-seed fields the finance shape omits (issue #47). */
  updatedAt: Date
  statementCloseDay: number | null
  paymentNote: string | null
  notes: string | null
  ownerMemberId: string | null
  /** Restrict-FK dependents — the delete confirm lists these (issue #57). */
  scheduledPaymentCount: number
  statementCount: number
  hasAutopayLink: boolean
}

export interface CardPortfolio {
  cards: PortfolioCard[]
  summary: PortfolioSummary
  promoPlans: PromoPayoffPlan[]
  /** The clock every derived figure was computed with — downstream
   *  consumers (attention builder) must reuse it, never a fresh Date. */
  asOf: Date
}

function toPortfolioCard(
  row: CardRow,
  priorities: Map<string, number>,
  coveredByPayment: ReadonlyMap<string, boolean>,
  today: Date
): PortfolioCard {
  const finance = toFinanceCard(row)
  const daysUntilDue = dueInDays(row.paymentDueDay, today)
  // Coverage (issue #46): a claiming SCHEDULED payment (the runway engine's
  // own greedy-claim rule — one derivation path) OR confirmed provider
  // autopay (EDR-016). Feeds the alert engine's dueCovered input.
  const autopayActive = row.autopayLink?.autopayActive ?? false
  const dueCovered = autopayActive || (coveredByPayment.get(row.id) ?? false)
  const alert = resolveAlert(
    {
      ...finance,
      dueInDays: daysUntilDue,
      dueCovered,
    },
    today
  )
  return {
    id: row.id,
    cardName: row.cardName,
    lastFour: row.lastFour,
    issuer: row.issuer,
    issuerKey: row.issuerKey,
    ownerLabel: row.ownerMember?.displayName ?? null,
    lifecycle: row.lifecycle as Lifecycle,
    statusBadge: resolveStatusBadge(row.lifecycle as Lifecycle, alert),
    alert,
    syncStatus: row.syncStatus as ConnectionState,
    utilization: utilization(finance.balanceMinor, finance.limitMinor),
    paydownPriority: priorities.get(row.id) ?? null,
    paymentDueDay: row.paymentDueDay,
    dueInDays: daysUntilDue,
    dueCovered,
    autopayActive,
    autopayProviderUrl: row.autopayLink?.providerUrl ?? null,
    finance,
    hasEstimatedInputs:
      row.aprSource === "UNKNOWN" || row.limitSource === "UNKNOWN" || row.minimumSource === "UNKNOWN",
    updatedAt: row.updatedAt,
    statementCloseDay: row.statementCloseDay,
    paymentNote: row.paymentNote,
    notes: row.notes,
    ownerMemberId: row.ownerMemberId,
    scheduledPaymentCount: row._count.scheduledPayments,
    statementCount: row._count.statements,
    hasAutopayLink: row.autopayLink != null,
  }
}

/**
 * Create a card from validated form input — the app's first CreditCard
 * mutation. The input → row mapping (promo + provenance conventions) is
 * the pure, unit-tested toCreateCardData; the household is get-or-created
 * so zero-card users are functional. The zero-membership branch itself is
 * exercised by the deriveHouseholdIdentity unit tests + manual QA — the
 * e2e demo user always has a seeded membership.
 */
export async function createCardForUser(
  userId: string,
  input: CreateCardInput
): Promise<{ cardId: string }> {
  const householdId = await findOrCreateHouseholdForUser(userId)
  // Owner FK verified on CREATE exactly as on edit (review finding — the
  // #45 lesson applies to every path that persists a client-submitted id).
  if (input.ownerMemberId != null) {
    const ok = await verifyHouseholdMember(householdId, input.ownerMemberId)
    if (!ok) throw new ForeignOwnerError("Pick a member of your household.")
  }
  const card = await createCard(householdId, toCreateCardData(input))
  await emitDomainEvent({
    type: "CardAdded",
    userId,
    householdId,
    cardId: card.id,
    cardName: input.cardName,
  })
  return { cardId: card.id }
}

/** Thrown when the owner picker submits a non-household member id — the
 *  action maps it to a field error (EDR-014; the #45 cross-tenant lesson). */
export class ForeignOwnerError extends Error {}

/** Thrown when the edit's compare-and-swap finds the card changed since the
 *  sheet was seeded — the action maps it to a reload message, never a
 *  silent overwrite (review finding: lost update). */
export class StaleCardError extends Error {}

/**
 * Update a card from validated form input (issue #47). Same conventions as
 * create (toUpdateCardData); the owner FK is verified against the caller's
 * household BEFORE the write — the card WHERE alone doesn't cover a
 * client-submitted member id. Cross-household/missing card ids update zero
 * rows and throw. Audited with the changed field names (not values — the
 * before/after diff stays in the event details' changedFields list).
 */
export async function updateCardForUser(
  userId: string,
  input: EditCardInput
): Promise<{ cardId: string }> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")
  if (input.ownerMemberId != null) {
    const ok = await verifyHouseholdMember(householdId, input.ownerMemberId)
    if (!ok) throw new ForeignOwnerError("Pick a member of your household.")
  }
  const data = toUpdateCardData(input)
  const { status, before } = await updateCard(
    householdId,
    input.cardId,
    data,
    input.expectedUpdatedAt
  )
  if (status === "not-found") throw new Error("Not authorized")
  if (status === "conflict") throw new StaleCardError("card changed since seed")
  await emitDomainEvent({
    type: "CardUpdated",
    userId,
    householdId,
    cardId: input.cardId,
    cardName: input.cardName,
    changedFields: changedCardFields(before, data),
  })
  return { cardId: input.cardId }
}

/**
 * Delete a card and its Restrict-linked rows (issue #47 + #57's delete
 * half) — the explicit audited removal Marti chose 2026-07-25 (recorded
 * deviation from the blueprint's archive-first CardArchived model). The
 * repository resolves scheduled payments, statements, and the autopay link
 * in ONE transaction; the event records exactly what went. Cross-household
 * or missing ids delete zero rows and throw.
 */
export async function deleteCardForUser(
  userId: string,
  cardId: string
): Promise<{ cardName: string }> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")
  const result = await deleteCardWithDependents(householdId, cardId)
  if (!result || result.deleted === 0) throw new Error("Not authorized")
  await emitDomainEvent({
    type: "CardDeleted",
    userId,
    householdId,
    cardId,
    cardName: result.cardName ?? "Card",
    removedScheduledPayments: result.removedScheduledPayments,
    removedStatements: result.removedStatements,
    removedAutopayLink: result.removedAutopayLink,
  })
  return { cardName: result.cardName ?? "Card" }
}

/**
 * Fresh Restrict-dependent counts for the delete confirmation (issue #57).
 * Read AT DIALOG-OPEN TIME, not page load — the seed's counts can be stale
 * by the time the user deletes (review finding: the confirm must list what
 * will actually go). null ⇒ no such card in the caller's household.
 */
export async function getCardDependentsForUser(userId: string, cardId: string) {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) return null
  return findCardDependents(householdId, cardId)
}

/** Household members for the owner picker (issue #78); [] when no household. */
export async function getHouseholdMembersForUser(
  userId: string
): Promise<Array<{ id: string; displayName: string }>> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) return []
  return findHouseholdMembers(householdId)
}

/**
 * Freeze or unfreeze a card (issue #27) — an in-app tracking state only
 * (EDR-007); it never contacts the issuer. The household is looked up, NOT
 * created (the target card must already exist); a cross-household or missing
 * id updates zero rows and throws, which the action maps to a failure result.
 * The mutation is audited through the events seam.
 */
export async function setCardFrozenForUser(
  userId: string,
  cardId: string,
  frozen: boolean
): Promise<{ frozen: boolean }> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")
  const lifecycle = frozen ? "FROZEN" : "ACTIVE"
  const { updated, cardName } = await setCardLifecycle(householdId, cardId, lifecycle)
  if (updated === 0) throw new Error("Not authorized")
  await emitDomainEvent({
    type: frozen ? "CardFrozen" : "CardUnfrozen",
    userId,
    householdId,
    cardId,
    cardName: cardName ?? "Card",
  })
  return { frozen }
}

/** The full portfolio for a user's household; empty portfolio when none. */
export async function getCardPortfolio(userId: string, today = new Date()): Promise<CardPortfolio> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) {
    return {
      cards: [],
      summary: portfolioSummary([], today),
      promoPlans: [],
      asOf: today,
    }
  }
  const rows = await findHouseholdCards(householdId)
  const finance = rows.map(toFinanceCard)
  const priorities = paydownRank(finance, today)
  // Payment-claim coverage comes from the runway engine's OWN projection —
  // reusing its greedy-claim rule rather than re-deriving it (EDR-003/019).
  const paymentRows = await findScheduledPayments(householdId)
  const lanes = runwayAggregate(
    rows.map(toRunwayCard),
    paymentRows.map(toRunwayPayment),
    today
  ).lanes
  const coveredByPayment = new Map(
    lanes.map((lane) => [
      lane.cardId,
      lane.events.find((e) => e.kind === "due")?.covered ?? false,
    ])
  )
  const cards = rows
    .map((r) => toPortfolioCard(r, priorities, coveredByPayment, today))
    .sort(
      (a, b) =>
        (a.paydownPriority ?? Number.POSITIVE_INFINITY) -
          (b.paydownPriority ?? Number.POSITIVE_INFINITY) ||
        (b.utilization ?? 0) - (a.utilization ?? 0)
    )
  return {
    cards,
    summary: portfolioSummary(finance, today),
    promoPlans: promoPayoffPlans(finance, today),
    asOf: today,
  }
}
