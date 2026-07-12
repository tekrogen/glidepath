/**
 * Cards service — assembles the card portfolio for UI consumption.
 * Business rules live here and in lib/finance; the repository owns Prisma;
 * pages/queries own auth context (arch doc §15).
 */
import {
  paydownRank,
  portfolioSummary,
  promoPayoffPlans,
  utilization,
  type FinanceCard,
  type PortfolioSummary,
  type PromoPayoffPlan,
} from "@/lib/finance"
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
  today: Date
): PortfolioCard {
  const finance = toFinanceCard(row)
  const daysUntilDue = dueInDays(row.paymentDueDay, today)
  const alert = resolveAlert(
    {
      ...finance,
      dueInDays: daysUntilDue,
      // Autopay/scheduled-payment coverage arrives in Phase 3 — until then a
      // known due day within the window alerts unless the card is frozen.
      dueCovered: false,
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
  const cards = rows
    .map((r) => toPortfolioCard(r, priorities, today))
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
