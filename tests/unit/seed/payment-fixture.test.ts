/**
 * Payment-domain fixture conformance (issue #42, SEED_VERSION 3).
 *
 * Pure invariants over the seed literals — no DB. Pinned counts follow the
 * dataset discipline (the seed IS the fixture): growing the fixture means
 * updating these numbers knowingly, never accidentally.
 */
import { describe, expect, it } from "vitest"

import { SEED_CARDS } from "../../../prisma/seed-data/glidepath-cards"
import {
  SEED_AUTOPAY_LINKS,
  SEED_FINANCIAL_ACCOUNTS,
  SEED_SCHEDULED_PAYMENTS,
  SEED_STATEMENTS,
} from "../../../prisma/seed-data/glidepath-payments"

const cardNames = new Set(SEED_CARDS.map((c) => c.cardName))
const accountNames = new Set(SEED_FINANCIAL_ACCOUNTS.map((a) => a.name))
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

describe("payment-domain fixture (SEED_VERSION 3)", () => {
  it("has the pinned row counts", () => {
    expect(SEED_FINANCIAL_ACCOUNTS).toHaveLength(1)
    expect(SEED_SCHEDULED_PAYMENTS).toHaveLength(5)
    expect(SEED_STATEMENTS).toHaveLength(3)
    expect(SEED_AUTOPAY_LINKS).toHaveLength(2)
  })

  it("references are resolvable by unique name (never by last4)", () => {
    // Card names must be unique for name-keyed seeding to be sound
    expect(cardNames.size).toBe(SEED_CARDS.length)
    expect(accountNames.size).toBe(SEED_FINANCIAL_ACCOUNTS.length)
    for (const p of SEED_SCHEDULED_PAYMENTS) {
      expect(cardNames.has(p.cardName), `payment card ${p.cardName}`).toBe(true)
      if (p.fundingAccountName) {
        expect(accountNames.has(p.fundingAccountName), `funding ${p.fundingAccountName}`).toBe(true)
      }
    }
    for (const s of SEED_STATEMENTS) {
      expect(cardNames.has(s.cardName), `statement card ${s.cardName}`).toBe(true)
    }
    for (const l of SEED_AUTOPAY_LINKS) {
      expect(cardNames.has(l.cardName), `autopay card ${l.cardName}`).toBe(true)
    }
  })

  it("scheduled payments: positive amounts, valid dates, resolvedAt iff resolved", () => {
    for (const p of SEED_SCHEDULED_PAYMENTS) {
      expect(p.amountMinor > 0n, `${p.cardName} amount`).toBe(true)
      expect(p.scheduledFor).toMatch(ISO_DATE)
      if (p.status === "SCHEDULED") {
        expect(p.resolvedAt, `${p.cardName} unresolved`).toBeNull()
      } else {
        expect(p.resolvedAt, `${p.cardName} resolved`).toMatch(ISO_DATE)
      }
    }
  })

  it("covers the runway edge fixtures: resolved rows and a funding-less payment", () => {
    const statuses = new Set(SEED_SCHEDULED_PAYMENTS.map((p) => p.status))
    expect(statuses.has("DONE")).toBe(true)
    expect(statuses.has("SKIPPED")).toBe(true)
    expect(SEED_SCHEDULED_PAYMENTS.some((p) => p.fundingAccountName === null)).toBe(true)
  })

  it("statements: one per card+closing date, coherent figures", () => {
    const keys = new Set(SEED_STATEMENTS.map((s) => `${s.cardName}|${s.closingDate}`))
    expect(keys.size).toBe(SEED_STATEMENTS.length) // @@unique([cardId, closingDate]) backstop
    for (const s of SEED_STATEMENTS) {
      expect(s.statementBalanceMinor >= 0n, `${s.cardName} balance`).toBe(true)
      expect(s.closingDate).toMatch(ISO_DATE)
      if (s.periodStart) expect(s.periodStart < s.closingDate, `${s.cardName} period`).toBe(true)
      if (s.dueDate) expect(s.closingDate < s.dueDate, `${s.cardName} due after close`).toBe(true)
      if (s.minimumDueMinor != null) {
        expect(s.minimumDueMinor <= s.statementBalanceMinor, `${s.cardName} min ≤ balance`).toBe(true)
      }
    }
  })

  it("autopay links: one per card, both PAY and AUTO chip states covered", () => {
    const linkCards = new Set(SEED_AUTOPAY_LINKS.map((l) => l.cardName))
    expect(linkCards.size).toBe(SEED_AUTOPAY_LINKS.length) // @@unique([cardId]) backstop
    expect(SEED_AUTOPAY_LINKS.some((l) => l.autopayActive)).toBe(true)
    expect(SEED_AUTOPAY_LINKS.some((l) => !l.autopayActive)).toBe(true)
  })
})
