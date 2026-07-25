/**
 * Pure intent rules (issue #45): TTL, expiry, and confirm-completeness.
 * No I/O — the service applies these; the unit suite pins them (the
 * issue's exit criterion for expiry). Status flips to EXPIRED and the
 * PaymentIntentExpired event arrive with the #46 cron; until then these
 * rules alone keep expired drafts unresumable and unconfirmable.
 */
import { daysUntil, MAX_AMOUNT_MINOR, type Minor } from "@/lib/finance"

/** Sliding draft lifetime — every save re-arms it. */
export const INTENT_TTL_HOURS = 24

export function intentExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INTENT_TTL_HOURS * 60 * 60 * 1000)
}

/** Expiry is timestamp-exact: a draft is dead the moment expiresAt passes. */
export function isIntentExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export interface IntentForConfirm {
  cardId: string | null
  amountMinor: Minor | null
  scheduledFor: Date | null
}

export type IntentCompleteness =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Whose name a household-scoped cron event is recorded under: the OWNER
 * member's user, falling back to any member with a user (issue #46 —
 * events/audit require a userId, cron has no session).
 */
export function resolveHouseholdEventUser(
  members: Array<{ userId: string | null; role: string }>
): string | null {
  const owner = members.find((m) => m.role === "OWNER" && m.userId != null)
  if (owner?.userId) return owner.userId
  return members.find((m) => m.userId != null)?.userId ?? null
}

/**
 * Server-side completeness gate for confirm — validates the DB row, never
 * client claims. Dates compare UTC date-only (a payment scheduled for
 * today is fine); amounts re-check the app-wide bound.
 */
export function validateIntentComplete(
  intent: IntentForConfirm,
  today: Date
): IntentCompleteness {
  if (intent.cardId == null) return { ok: false, message: "Pick a card first." }
  if (intent.amountMinor == null || intent.amountMinor <= 0n) {
    return { ok: false, message: "Enter a payment amount." }
  }
  if (intent.amountMinor > MAX_AMOUNT_MINOR) {
    return { ok: false, message: "Amount must be $99,999,999.99 or less." }
  }
  if (intent.scheduledFor == null) return { ok: false, message: "Pick a payment date." }
  if (daysUntil(intent.scheduledFor, today) < 0) {
    return { ok: false, message: "The payment date has passed — pick a new one." }
  }
  return { ok: true }
}
