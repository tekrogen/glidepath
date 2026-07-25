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
import { emitDomainEvent } from "@/server/events/publishers"

import { toCreateCardData } from "./create-card-data"
import { toFinanceCard } from "./mappers"
import {
  createCard,
  findHouseholdCards,
  findHouseholdIdForUser,
  findOrCreateHouseholdForUser,
  setCardLifecycle,
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
