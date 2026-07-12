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

import { toFinanceCard } from "./mappers"
import {
  createCard,
  createHouseholdWithOwner,
  findHouseholdCards,
  findHouseholdIdForUser,
  findUserProfile,
  type CardRow,
} from "./repository"
import { issuerKeyFor } from "./tracker-import"

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
  const alert = resolveAlert(
    {
      ...finance,
      dueInDays: dueInDays(row.paymentDueDay, today),
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
    finance,
    hasEstimatedInputs:
      row.aprSource === "UNKNOWN" || row.limitSource === "UNKNOWN" || row.minimumSource === "UNKNOWN",
  }
}

/** Get-or-create the user's household so zero-card users are functional (issue #26). */
async function resolveHouseholdIdForUser(userId: string): Promise<string> {
  const existing = await findHouseholdIdForUser(userId)
  if (existing) return existing
  const profile = await findUserProfile(userId)
  const firstName = profile?.name?.trim().split(/\s+/)[0] || null
  const displayName = firstName ?? profile?.email?.split("@")[0] ?? "Owner"
  const householdName = firstName ? `${firstName}'s Household` : "My Household"
  const household = await createHouseholdWithOwner(userId, householdName, displayName)
  return household.id
}

/**
 * Create a card from validated form input — the app's first CreditCard
 * mutation. Mapping follows the seed/import promo convention exactly:
 * an active promo moves the card-level APR onto the PromoPeriod
 * (regularAprBpsAfter) and shelters the current balance; provenance is
 * presence-based (MANUAL when the user supplied a value, else UNKNOWN).
 */
export async function createCardForUser(
  userId: string,
  input: CreateCardInput
): Promise<{ cardId: string }> {
  const householdId = await resolveHouseholdIdForUser(userId)
  // The schema guarantees promoEndsOn when hasPromo — this narrows the type.
  const promoActive = input.hasPromo && input.promoEndsOn != null
  const card = await createCard(householdId, {
    cardName: input.cardName,
    lastFour: input.lastFour,
    issuer: input.issuer,
    issuerKey: issuerKeyFor(input.issuer),
    creditLimitMinor: input.creditLimitMinor,
    currentBalanceMinor: input.currentBalanceMinor,
    // While a promo is active the card-level APR is null; the post-promo
    // rate lives on the PromoPeriod (schema convention, Level 6).
    regularAprBps: promoActive ? null : input.regularAprBps,
    paymentDueDay: input.paymentDueDay,
    statementCloseDay: input.statementCloseDay,
    minimumPaymentMinor: input.minimumPaymentMinor,
    paymentNote: input.paymentNote,
    notes: input.notes,
    limitSource: input.creditLimitMinor != null ? "MANUAL" : "UNKNOWN",
    aprSource: input.regularAprBps != null || promoActive ? "MANUAL" : "UNKNOWN",
    minimumSource: input.minimumPaymentMinor != null ? "MANUAL" : "UNKNOWN",
    promo: promoActive
      ? {
          endsOn: input.promoEndsOn!,
          regularAprBpsAfter: input.regularAprBps,
          shelteredBalanceMinor: input.currentBalanceMinor,
        }
      : null,
  })
  await emitDomainEvent({
    type: "CardAdded",
    userId,
    householdId,
    cardId: card.id,
    cardName: input.cardName,
  })
  return { cardId: card.id }
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
