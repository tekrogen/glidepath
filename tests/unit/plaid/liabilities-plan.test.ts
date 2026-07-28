/**
 * Liabilities normalization + apply-plan conformance (issue #109, EDR-026).
 *
 * Anchored to exact bps/cents figures. The load-bearing rules under test:
 * Plaid percentages → integer bps and float dollars → bigint minor at the
 * boundary (EDR-008); user-entered values are NEVER auto-overwritten — a
 * present non-PLAID field diverging becomes a suggestion (Blueprint
 * truth-ownership; the "Plaid reports APR 24.99% — you recorded 25.5%" row);
 * promo-active cards never receive APR writes (card-level APR is null by
 * convention while a promo runs).
 */
import { APRAprTypeEnum, type AccountBase, type CreditCardLiability } from "plaid"
import { describe, expect, it } from "vitest"

import { percentNumberToBps } from "@/lib/finance"
import {
  normalizeCreditLiability,
  planLiabilityApply,
  type CardProvenanceSnapshot,
} from "@/features/cards/server/liabilities-plan"

const liability = (over: Partial<CreditCardLiability>): CreditCardLiability => ({
  account_id: "acct-1",
  aprs: [],
  is_overdue: null,
  last_payment_amount: null,
  last_payment_date: null,
  last_statement_issue_date: null,
  last_statement_balance: null,
  minimum_payment_amount: null,
  next_payment_due_date: null,
  ...over,
})

const account = (over?: {
  current?: number | null
  limit?: number | null
  iso?: string | null
}): AccountBase =>
  ({
    account_id: "acct-1",
    balances: {
      available: null,
      current: over?.current ?? null,
      limit: over?.limit ?? null,
      iso_currency_code: over?.iso === undefined ? "USD" : over.iso,
      unofficial_currency_code: null,
    },
    mask: "3333",
    name: "Plaid Credit Card",
    official_name: null,
    type: "credit",
    subtype: "credit card",
  }) as AccountBase

const card = (over?: Partial<CardProvenanceSnapshot>): CardProvenanceSnapshot => ({
  currency: "USD",
  regularAprBps: null,
  aprSource: "UNKNOWN",
  creditLimitMinor: null,
  limitSource: "UNKNOWN",
  minimumPaymentMinor: null,
  minimumSource: "UNKNOWN",
  paymentDueDay: null,
  dueDaySource: "UNKNOWN",
  hasActivePromo: false,
  ...over,
})

describe("percentNumberToBps", () => {
  it("converts Plaid percentages to exact bps", () => {
    expect(percentNumberToBps(22.74)).toBe(2274)
    expect(percentNumberToBps(19.24)).toBe(1924)
    expect(percentNumberToBps(0)).toBe(0)
    // float artifact: 29.99 * 100 = 2998.9999... — must round, not truncate
    expect(percentNumberToBps(29.99)).toBe(2999)
  })

  it("rejects out-of-window and non-finite values", () => {
    expect(percentNumberToBps(100)).toBeNull()
    expect(percentNumberToBps(-1)).toBeNull()
    expect(percentNumberToBps(Number.NaN)).toBeNull()
  })
})

describe("normalizeCreditLiability", () => {
  it("converts floats/percentages/dates to minor units, bps, day-of-month", () => {
    const n = normalizeCreditLiability(
      liability({
        aprs: [
          {
            apr_percentage: 22.74,
            apr_type: APRAprTypeEnum.PurchaseApr,
            balance_subject_to_apr: null,
            interest_charge_amount: null,
          },
        ],
        minimum_payment_amount: 35.5,
        next_payment_due_date: "2026-08-17",
        last_statement_balance: 1543.21,
      }),
      account({ current: 410.32, limit: 25000 })
    )
    expect(n.currentBalanceMinor).toBe(41032n)
    expect(n.statementBalanceMinor).toBe(154321n)
    expect(n.creditLimitMinor).toBe(2500000n)
    expect(n.regularAprBps).toBe(2274)
    expect(n.minimumPaymentMinor).toBe(3550n)
    expect(n.paymentDueDay).toBe(17)
    expect(n.warnings).toEqual([])
  })

  it("only the purchase APR maps to the card-level rate; others warn", () => {
    const n = normalizeCreditLiability(
      liability({
        aprs: [
          {
            apr_percentage: 27.5,
            apr_type: APRAprTypeEnum.CashApr,
            balance_subject_to_apr: null,
            interest_charge_amount: null,
          },
        ],
      }),
      account()
    )
    expect(n.regularAprBps).toBeNull()
    expect(n.warnings).toEqual(["no purchase APR reported (got: cash_apr)"])
  })

  it("clamps negative owed amounts to 0 with a warning; drops non-positive limits", () => {
    const n = normalizeCreditLiability(
      liability({ last_statement_balance: -25.0 }),
      account({ current: -10.5, limit: 0 })
    )
    expect(n.currentBalanceMinor).toBe(0n)
    expect(n.statementBalanceMinor).toBe(0n)
    expect(n.creditLimitMinor).toBeNull()
    expect(n.warnings).toHaveLength(2)
  })

  it("absent fields normalize to null, never to zero", () => {
    const n = normalizeCreditLiability(liability({}), account())
    expect(n.currentBalanceMinor).toBeNull()
    expect(n.statementBalanceMinor).toBeNull()
    expect(n.regularAprBps).toBeNull()
    expect(n.minimumPaymentMinor).toBeNull()
    expect(n.paymentDueDay).toBeNull()
  })
})

describe("planLiabilityApply — truth-ownership gates", () => {
  const full = () =>
    normalizeCreditLiability(
      liability({
        aprs: [
          {
            apr_percentage: 24.99,
            apr_type: APRAprTypeEnum.PurchaseApr,
            balance_subject_to_apr: null,
            interest_charge_amount: null,
          },
        ],
        minimum_payment_amount: 40,
        next_payment_due_date: "2026-08-17",
        last_statement_balance: 1200,
      }),
      account({ current: 950.25, limit: 10000 })
    )

  it("empty card: everything fills with PLAID provenance", () => {
    const plan = planLiabilityApply(card(), full())
    expect(plan.sets).toEqual({
      currentBalanceMinor: 95025n,
      statementBalanceMinor: 120000n,
      creditLimitMinor: 1000000n,
      limitSource: "PLAID",
      regularAprBps: 2499,
      aprSource: "PLAID",
      minimumPaymentMinor: 4000n,
      minimumSource: "PLAID",
      paymentDueDay: 17,
      dueDaySource: "PLAID",
    })
    expect(plan.suggestions).toEqual([])
  })

  it("the Blueprint row: manual APR 25.5% vs Plaid 24.99% → suggestion, no write", () => {
    const plan = planLiabilityApply(
      card({ regularAprBps: 2550, aprSource: "MANUAL" }),
      full()
    )
    expect(plan.sets.regularAprBps).toBeUndefined()
    expect(plan.sets.aprSource).toBeUndefined()
    expect(plan.suggestions).toContainEqual({
      field: "REGULAR_APR_BPS",
      proposedValue: "2499",
      currentValue: "2550",
    })
  })

  it("a present value with UNKNOWN source is user-owned — suggested, never overwritten (pre-#109 dueDaySource rows)", () => {
    const plan = planLiabilityApply(
      card({ paymentDueDay: 5, dueDaySource: "UNKNOWN" }),
      full()
    )
    expect(plan.sets.paymentDueDay).toBeUndefined()
    expect(plan.suggestions).toContainEqual({
      field: "PAYMENT_DUE_DAY",
      proposedValue: "17",
      currentValue: "5",
    })
  })

  it("PLAID-owned fields refresh freely; equal manual values stay silent", () => {
    const plan = planLiabilityApply(
      card({
        creditLimitMinor: 900000n,
        limitSource: "PLAID",
        minimumPaymentMinor: 4000n,
        minimumSource: "MANUAL",
      }),
      full()
    )
    expect(plan.sets.creditLimitMinor).toBe(1000000n)
    expect(plan.sets.minimumPaymentMinor).toBeUndefined()
    expect(plan.suggestions).toEqual([])
  })

  it("active promo: APR neither written nor suggested, other fields unaffected", () => {
    const plan = planLiabilityApply(card({ hasActivePromo: true }), full())
    expect(plan.sets.regularAprBps).toBeUndefined()
    expect(plan.sets.aprSource).toBeUndefined()
    expect(plan.suggestions.find((s) => s.field === "REGULAR_APR_BPS")).toBeUndefined()
    expect(plan.sets.minimumPaymentMinor).toBe(4000n)
    expect(plan.warnings).toContain("active promo — provider APR not applied")
  })

  it("currency mismatch aborts the entire plan", () => {
    const plan = planLiabilityApply(card({ currency: "CAD" }), full())
    expect(plan.sets).toEqual({})
    expect(plan.suggestions).toEqual([])
    expect(plan.warnings.at(-1)).toMatch(/USD ≠ card currency CAD/)
  })

  it("balances always refresh even when every gated field is manual", () => {
    const plan = planLiabilityApply(
      card({
        regularAprBps: 2499,
        aprSource: "MANUAL",
        creditLimitMinor: 1000000n,
        limitSource: "MANUAL",
        minimumPaymentMinor: 4000n,
        minimumSource: "MANUAL",
        paymentDueDay: 17,
        dueDaySource: "MANUAL",
      }),
      full()
    )
    expect(plan.sets).toEqual({
      currentBalanceMinor: 95025n,
      statementBalanceMinor: 120000n,
    })
    expect(plan.suggestions).toEqual([])
  })
})
