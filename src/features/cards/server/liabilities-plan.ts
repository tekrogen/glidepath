/**
 * Plaid Liabilities → card-domain planning (issue #109, EDR-026).
 *
 * Pure module in the tracker-import mold: normalization converts Plaid's
 * float dollars / percent numbers / ISO date strings into the card domain's
 * bigint minor units, integer bps, and day-of-month — every ambiguity becomes
 * a warning, nothing is guessed silently. The apply-planner then enforces the
 * Blueprint truth-ownership rules (never auto-overwrite a user-entered
 * field): balances are provider-owned and always set; APR/limit/minimum/due
 * day are provenance-gated — UNKNOWN fills, PLAID refreshes, MANUAL diverging
 * becomes a suggestion the user accepts or dismisses.
 *
 * No I/O and no Prisma here; the commit half lives in liabilities-sync.ts.
 */
import type { AccountBase, CreditCardLiability } from "plaid"

import { percentNumberToBps, type AprBps, type Minor } from "@/lib/finance"

import { toMinor } from "./tracker-import"

// String-literal mirror of the Prisma enums so this module stays ORM-free.
export type FieldProvenance = "PLAID" | "MANUAL" | "UNKNOWN"
export type SuggestedFieldKey =
  | "REGULAR_APR_BPS"
  | "CREDIT_LIMIT_MINOR"
  | "MINIMUM_PAYMENT_MINOR"
  | "PAYMENT_DUE_DAY"

export interface NormalizedLiability {
  accountId: string
  isoCurrencyCode: string | null
  currentBalanceMinor: Minor | null
  statementBalanceMinor: Minor | null
  creditLimitMinor: Minor | null
  regularAprBps: AprBps | null
  minimumPaymentMinor: Minor | null
  paymentDueDay: number | null
  isOverdue: boolean | null
  warnings: string[]
}

/** Clamp a float-dollar amount to non-negative minor units, warning on clamp. */
function owedMinor(
  amount: number | null | undefined,
  label: string,
  warnings: string[]
): Minor | null {
  if (amount == null) return null
  if (amount < 0) {
    warnings.push(`${label} is negative (${amount}) — stored as $0.00 owed`)
    return 0n
  }
  return toMinor(amount)
}

/** Day-of-month from a Plaid ISO date string (YYYY-MM-DD). */
function dayOfMonth(iso: string | null | undefined, warnings: string[]): number | null {
  if (!iso) return null
  const day = Number(iso.slice(8, 10))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || day < 1 || day > 31) {
    warnings.push(`unparseable due date "${iso}" — ignored`)
    return null
  }
  return day
}

/**
 * Normalize one Plaid credit liability (+ its AccountBase, joined upstream by
 * account_id — never by mask) into card-domain units.
 */
export function normalizeCreditLiability(
  liability: CreditCardLiability,
  account: AccountBase | undefined
): NormalizedLiability {
  const warnings: string[] = []
  const balances = account?.balances

  // APR: the card-level rate is the purchase APR; other APR types (cash,
  // balance-transfer, special) have no card-domain home yet — never guessed.
  let regularAprBps: AprBps | null = null
  const purchase = liability.aprs.find((a) => a.apr_type === "purchase_apr")
  if (purchase) {
    regularAprBps = percentNumberToBps(purchase.apr_percentage)
    if (regularAprBps === null) {
      warnings.push(`purchase APR ${purchase.apr_percentage}% outside 0–99.99% — ignored`)
    }
  } else if (liability.aprs.length > 0) {
    warnings.push(
      `no purchase APR reported (got: ${liability.aprs.map((a) => a.apr_type).join(", ")})`
    )
  }

  const limitRaw = balances?.limit
  const creditLimitMinor = limitRaw != null && limitRaw > 0 ? toMinor(limitRaw) : null

  return {
    accountId: account?.account_id ?? liability.account_id ?? "",
    isoCurrencyCode: balances?.iso_currency_code ?? null,
    currentBalanceMinor: owedMinor(balances?.current, "current balance", warnings),
    statementBalanceMinor: owedMinor(
      liability.last_statement_balance,
      "statement balance",
      warnings
    ),
    creditLimitMinor,
    regularAprBps,
    minimumPaymentMinor: owedMinor(
      liability.minimum_payment_amount,
      "minimum payment",
      warnings
    ),
    paymentDueDay: dayOfMonth(liability.next_payment_due_date, warnings),
    isOverdue: liability.is_overdue,
    warnings,
  }
}

export interface CardProvenanceSnapshot {
  currency: string
  regularAprBps: number | null
  aprSource: FieldProvenance
  creditLimitMinor: bigint | null
  limitSource: FieldProvenance
  minimumPaymentMinor: bigint | null
  minimumSource: FieldProvenance
  paymentDueDay: number | null
  dueDaySource: FieldProvenance
  /** Active promo ⇒ card-level APR is null by convention — never write or suggest APR. */
  hasActivePromo: boolean
}

export interface SuggestionInput {
  field: SuggestedFieldKey
  proposedValue: string
  currentValue: string | null
}

export interface LiabilityApplyPlan {
  sets: {
    currentBalanceMinor?: bigint
    statementBalanceMinor?: bigint
    creditLimitMinor?: bigint
    limitSource?: "PLAID"
    regularAprBps?: number
    aprSource?: "PLAID"
    minimumPaymentMinor?: bigint
    minimumSource?: "PLAID"
    paymentDueDay?: number
    dueDaySource?: "PLAID"
  }
  suggestions: SuggestionInput[]
  warnings: string[]
}

type GateOutcome =
  | { kind: "set" }
  | { kind: "suggest"; current: string | null }
  | { kind: "skip" }

/**
 * Truth-ownership gate for one provenance-tracked field.
 *
 * Presence beats provenance metadata: a present value whose source is not
 * PLAID is treated as user-owned even when the source column says UNKNOWN —
 * pre-#109 rows have UNKNOWN on columns that were human-populated (every
 * existing card's dueDaySource, for one), and overwriting them would be the
 * exact auto-mutation the Blueprint forbids. Empty fields fill; PLAID-owned
 * fields refresh; everything else diverging becomes a suggestion.
 */
function gate(
  source: FieldProvenance,
  current: string | null,
  proposed: string
): GateOutcome {
  if (current === null || source === "PLAID") return { kind: "set" }
  return current === proposed ? { kind: "skip" } : { kind: "suggest", current }
}

/**
 * Plan the card-domain writes and suggestions for one normalized liability.
 * Currency mismatch aborts the whole plan (multi-currency sums are never
 * implicit — EDR-008).
 */
export function planLiabilityApply(
  card: CardProvenanceSnapshot,
  normalized: NormalizedLiability
): LiabilityApplyPlan {
  const warnings = [...normalized.warnings]

  if (
    normalized.isoCurrencyCode !== null &&
    normalized.isoCurrencyCode !== card.currency
  ) {
    warnings.push(
      `provider currency ${normalized.isoCurrencyCode} ≠ card currency ${card.currency} — nothing applied`
    )
    return { sets: {}, suggestions: [], warnings }
  }

  const sets: LiabilityApplyPlan["sets"] = {}
  const suggestions: SuggestionInput[] = []

  // Balances are provider-owned — always refreshed, no provenance gate.
  if (normalized.currentBalanceMinor !== null) {
    sets.currentBalanceMinor = normalized.currentBalanceMinor
  }
  if (normalized.statementBalanceMinor !== null) {
    sets.statementBalanceMinor = normalized.statementBalanceMinor
  }

  if (normalized.creditLimitMinor !== null) {
    const outcome = gate(
      card.limitSource,
      card.creditLimitMinor === null ? null : card.creditLimitMinor.toString(),
      normalized.creditLimitMinor.toString()
    )
    if (outcome.kind === "set") {
      sets.creditLimitMinor = normalized.creditLimitMinor
      sets.limitSource = "PLAID"
    } else if (outcome.kind === "suggest") {
      suggestions.push({
        field: "CREDIT_LIMIT_MINOR",
        proposedValue: normalized.creditLimitMinor.toString(),
        currentValue: outcome.current,
      })
    }
  }

  if (normalized.regularAprBps !== null) {
    if (card.hasActivePromo) {
      // Card-level APR is null while a promo is active (rate lives on the
      // PromoPeriod); the provider's purchase APR may be the promo rate —
      // never written, never suggested.
      warnings.push("active promo — provider APR not applied")
    } else {
      const outcome = gate(
        card.aprSource,
        card.regularAprBps === null ? null : String(card.regularAprBps),
        String(normalized.regularAprBps)
      )
      if (outcome.kind === "set") {
        sets.regularAprBps = normalized.regularAprBps
        sets.aprSource = "PLAID"
      } else if (outcome.kind === "suggest") {
        suggestions.push({
          field: "REGULAR_APR_BPS",
          proposedValue: String(normalized.regularAprBps),
          currentValue: outcome.current,
        })
      }
    }
  }

  if (normalized.minimumPaymentMinor !== null) {
    const outcome = gate(
      card.minimumSource,
      card.minimumPaymentMinor === null ? null : card.minimumPaymentMinor.toString(),
      normalized.minimumPaymentMinor.toString()
    )
    if (outcome.kind === "set") {
      sets.minimumPaymentMinor = normalized.minimumPaymentMinor
      sets.minimumSource = "PLAID"
    } else if (outcome.kind === "suggest") {
      suggestions.push({
        field: "MINIMUM_PAYMENT_MINOR",
        proposedValue: normalized.minimumPaymentMinor.toString(),
        currentValue: outcome.current,
      })
    }
  }

  if (normalized.paymentDueDay !== null) {
    const outcome = gate(
      card.dueDaySource,
      card.paymentDueDay === null ? null : String(card.paymentDueDay),
      String(normalized.paymentDueDay)
    )
    if (outcome.kind === "set") {
      sets.paymentDueDay = normalized.paymentDueDay
      sets.dueDaySource = "PLAID"
    } else if (outcome.kind === "suggest") {
      suggestions.push({
        field: "PAYMENT_DUE_DAY",
        proposedValue: String(normalized.paymentDueDay),
        currentValue: outcome.current,
      })
    }
  }

  return { sets, suggestions, warnings }
}
