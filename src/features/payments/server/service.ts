/**
 * Payments service — assembles the Payment Runway inputs and owns the
 * reschedule rule (issue #44). Business rules live here and in
 * lib/finance; repositories own Prisma; pages/queries own auth context
 * (arch doc §15). Record-only (EDR-010): rescheduling moves a tracked
 * row's date — nothing here touches a real payment.
 */
import {
  daysUntil,
  RUNWAY_HORIZON_DAYS,
  type RunwayCard,
  type RunwayPayment,
} from "@/lib/finance"
import {
  findHouseholdCards,
  findHouseholdIdForUser,
} from "@/features/cards/server/repository"
import type { Lifecycle } from "@/features/cards/utils/card-status"
import { emitDomainEvent } from "@/server/events/publishers"

import type { IntentDraftInput } from "../schemas/intent-draft-schema"
import {
  intentExpiresAt,
  isIntentExpired,
  resolveHouseholdEventUser,
  validateIntentComplete,
} from "../utils/intent"
import { toRunwayCard, toRunwayPayment } from "./mappers"
import {
  createDraft,
  deleteDraft,
  expireStaleDrafts,
  IntentStateConflictError,
  findActiveDraft,
  findFundingAccounts,
  findIntentWithPayment,
  findScheduledPayments,
  recordPaymentForIntent,
  rescheduleScheduledPayment,
  updateDraft,
  verifyDraftReferences,
  type IntentRow,
} from "./repository"

/** A runway lane's card: engine shape + what the lane label renders. */
export interface RunwayPageCard extends RunwayCard {
  cardName: string
  lastFour: string | null
  lifecycle: Lifecycle
  /** EDR-016: user confirmed autopay at the issuer — renders the "auto ✓" cue. */
  autopayActive: boolean
}

export interface PaymentRunway {
  cards: RunwayPageCard[]
  payments: RunwayPayment[]
  /** The clock every derived figure was computed with — the page and the
   *  client recompute against this, never a fresh Date. */
  asOf: Date
}

/** Everything the runway page needs; empty when the user has no household. */
export async function getPaymentRunway(userId: string, today = new Date()): Promise<PaymentRunway> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) {
    return { cards: [], payments: [], asOf: today }
  }
  const [rows, paymentRows] = await Promise.all([
    findHouseholdCards(householdId),
    findScheduledPayments(householdId),
  ])
  const cards = rows.map((row) => ({
    ...toRunwayCard(row),
    cardName: row.cardName,
    lastFour: row.lastFour,
    lifecycle: row.lifecycle as Lifecycle,
    autopayActive: row.autopayLink?.autopayActive ?? false,
  }))
  return {
    cards,
    payments: paymentRows.map(toRunwayPayment),
    asOf: today,
  }
}

/** Thrown for date-rule violations so the action can answer with a specific message. */
export class RescheduleDateError extends Error {
  constructor(public readonly rule: "past" | "beyond-horizon") {
    super(`reschedule date rejected: ${rule}`)
  }
}

/** Thrown for user-facing intent rules — the action maps each to a specific result. */
export class IntentRuleError extends Error {
  constructor(
    public readonly rule:
      | "expired"
      | "incomplete"
      | "not-found"
      | "already-submitted"
      | "foreign-card"
      | "foreign-account",
    message: string
  ) {
    super(message)
  }
}

export interface PaymentSetup {
  cards: RunwayPageCard[]
  fundingAccounts: Array<{
    id: string
    name: string
    institution: string | null
    lastFour: string | null
  }>
  /** The resumable un-expired DRAFT, if any. */
  draft: IntentRow | null
  asOf: Date
}

/** Everything /payments/new needs; empty when the user has no household. */
export async function getPaymentSetup(userId: string, now = new Date()): Promise<PaymentSetup> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) {
    return { cards: [], fundingAccounts: [], draft: null, asOf: now }
  }
  const [rows, fundingAccounts, draft] = await Promise.all([
    findHouseholdCards(householdId),
    findFundingAccounts(householdId),
    findActiveDraft(householdId, now),
  ])
  const cards = rows.map((row) => ({
    ...toRunwayCard(row),
    cardName: row.cardName,
    lastFour: row.lastFour,
    lifecycle: row.lifecycle as Lifecycle,
    autopayActive: row.autopayLink?.autopayActive ?? false,
  }))
  return { cards, fundingAccounts, draft, asOf: now }
}

/**
 * Save the stepper's draft (issue #45): updates the caller's live draft,
 * reusing an existing one when the client has no id (two fresh tabs
 * converge on one draft), creating one otherwise. Foreign-key payloads
 * are resolved through household-scoped lookups first — the intent WHERE
 * alone doesn't cover them (review finding, critical). A SUBMITTED
 * intent is a hard stop, never a silent fresh draft: the ordinary
 * two-tab flow would double-record through that fall-through (review
 * finding). Only an EXPIRED/missing id falls through to a fresh draft.
 * Every save re-arms the sliding TTL. Drafts are ephemeral: no event.
 */
export async function saveIntentDraftForUser(
  userId: string,
  input: IntentDraftInput,
  now = new Date()
): Promise<{ intentId: string; expiresAt: Date }> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")

  const { cardOk, accountOk } = await verifyDraftReferences(
    householdId,
    input.cardId,
    input.fundingAccountId
  )
  if (!cardOk) throw new IntentRuleError("foreign-card", "Pick one of your cards.")
  if (!accountOk) throw new IntentRuleError("foreign-account", "Pick one of your funding accounts.")

  const expiresAt = intentExpiresAt(now)
  const fields = {
    cardId: input.cardId,
    fundingAccountId: input.fundingAccountId,
    amountMinor: input.amount,
    scheduledFor: input.scheduledFor,
    note: input.note,
  }

  if (input.intentId != null) {
    const updated = await updateDraft(householdId, input.intentId, fields, now, expiresAt)
    if (updated > 0) return { intentId: input.intentId, expiresAt }
    const existing = await findIntentWithPayment(householdId, input.intentId)
    if (existing?.status === "SUBMITTED") {
      throw new IntentRuleError(
        "already-submitted",
        "This payment was already recorded — start a new one."
      )
    }
    // Expired or missing — fall through to a fresh draft.
  } else {
    // No client id: converge on the household's live draft if one exists
    // (two fresh tabs must not mint sibling drafts — review finding). The
    // residual both-find-none race is accepted, same posture as
    // findOrCreateHouseholdForUser.
    const active = await findActiveDraft(householdId, now)
    if (active) {
      const updated = await updateDraft(householdId, active.id, fields, now, expiresAt)
      if (updated > 0) return { intentId: active.id, expiresAt }
    }
  }
  const draft = await createDraft(householdId, expiresAt)
  const updated = await updateDraft(householdId, draft.id, fields, now, expiresAt)
  if (updated === 0) throw new Error("Draft could not be saved")
  return { intentId: draft.id, expiresAt }
}

/**
 * Expire stale DRAFT intents (issue #46 — the cron's job, deferred from
 * #45). Flips DRAFT→EXPIRED transactionally, then emits one
 * PaymentIntentExpired per intent, attributed to the household OWNER
 * (events/audit require a userId; the cron has no session). A household
 * with no user-bearing member skips the event — the flip still happened.
 */
export async function expireStaleIntents(
  now = new Date()
): Promise<{ expired: number }> {
  const stale = await expireStaleDrafts(now)
  for (const intent of stale) {
    const userId = resolveHouseholdEventUser(intent.household.members)
    if (!userId) continue
    await emitDomainEvent({
      type: "PaymentIntentExpired",
      userId,
      householdId: intent.householdId,
      intentId: intent.id,
      expiredAt: intent.expiresAt.toISOString(),
    })
  }
  return { expired: stale.length }
}

/** Discard a live draft (start-over). Missing/foreign ids are a no-op. */
export async function discardIntentDraftForUser(userId: string, intentId: string): Promise<void> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")
  await deleteDraft(householdId, intentId)
}

/**
 * Record-only idempotent confirm (issue #45, EDR-010): validates the DB
 * row (never client claims), then records the ScheduledPayment under the
 * `intentId @unique` backstop — double-submit and two-tab confirms all
 * converge on one payment row. Re-confirming an already-SUBMITTED intent
 * returns its payment as an idempotent success. Audited through the
 * events seam (once — the winner's path only).
 */
export async function confirmIntentForUser(
  userId: string,
  intentId: string,
  now = new Date()
): Promise<{ paymentId: string; alreadyRecorded: boolean }> {
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")

  const intent = await findIntentWithPayment(householdId, intentId)
  if (!intent) throw new IntentRuleError("not-found", "That draft no longer exists.")

  if (intent.status === "SUBMITTED") {
    if (intent.scheduledPayment) return { paymentId: intent.scheduledPayment.id, alreadyRecorded: true }
    throw new Error(`SUBMITTED intent ${intentId} has no payment row`)
  }
  if (intent.status === "EXPIRED" || isIntentExpired(intent.expiresAt, now)) {
    throw new IntentRuleError("expired", "This draft expired — start a new payment.")
  }
  const completeness = validateIntentComplete(intent, now)
  if (!completeness.ok) throw new IntentRuleError("incomplete", completeness.message)

  // Defense in depth: re-verify the FK targets at record time too — the
  // draft was written under the same rule, but this is the money row.
  const refs = await verifyDraftReferences(householdId, intent.cardId, intent.fundingAccountId)
  if (!refs.cardOk) throw new IntentRuleError("foreign-card", "Pick one of your cards.")
  if (!refs.accountOk) {
    throw new IntentRuleError("foreign-account", "Pick one of your funding accounts.")
  }

  let paymentId: string
  let alreadyRecorded: boolean
  try {
    ;({ paymentId, alreadyRecorded } = await recordPaymentForIntent({
      id: intent.id,
      cardId: intent.cardId!,
      fundingAccountId: intent.fundingAccountId,
      amountMinor: intent.amountMinor!,
      scheduledFor: intent.scheduledFor!,
      note: intent.note,
    }))
  } catch (error) {
    if (error instanceof IntentStateConflictError) {
      // The expiry cron won the race mid-confirm; the payment rolled back.
      throw new IntentRuleError("expired", "This draft expired just now — start a new payment.")
    }
    throw error
  }

  if (!alreadyRecorded) {
    await emitDomainEvent({
      type: "PaymentScheduled",
      userId,
      householdId,
      cardId: intent.cardId!,
      cardName: intent.card?.cardName ?? "Card",
      paymentId,
      intentId: intent.id,
      amountCents: Number(intent.amountMinor!),
      scheduledFor: intent.scheduledFor!.toISOString().slice(0, 10),
    })
  }
  return { paymentId, alreadyRecorded }
}

/**
 * Move a SCHEDULED payment to a new date (issue #44). The date must sit
 * inside the runway window [today, today + 45): the window starts today
 * (back-dating records an intent that can no longer happen), and the
 * lane board is the only surface that can show or move the row — a date
 * beyond the horizon would strand it out of reach (review finding). A
 * cross-household, missing, or already-resolved id updates zero rows and
 * throws; the action maps that to a failure result. Audited through the
 * events seam.
 */
export async function reschedulePaymentForUser(
  userId: string,
  paymentId: string,
  scheduledFor: Date,
  today = new Date()
): Promise<{ scheduledFor: Date }> {
  const days = daysUntil(scheduledFor, today)
  if (days < 0) throw new RescheduleDateError("past")
  if (days >= RUNWAY_HORIZON_DAYS) throw new RescheduleDateError("beyond-horizon")
  const householdId = await findHouseholdIdForUser(userId)
  if (!householdId) throw new Error("Not authorized")
  const { updated, previousFor, cardId, cardName } = await rescheduleScheduledPayment(
    householdId,
    paymentId,
    scheduledFor
  )
  if (updated === 0) throw new Error("Not authorized")
  await emitDomainEvent({
    type: "PaymentRescheduled",
    userId,
    householdId,
    cardId: cardId ?? "unknown",
    cardName: cardName ?? "Card",
    paymentId,
    fromDate: previousFor ? previousFor.toISOString().slice(0, 10) : "unknown",
    toDate: scheduledFor.toISOString().slice(0, 10),
  })
  return { scheduledFor }
}
