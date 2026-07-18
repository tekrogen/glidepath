/**
 * Glidepath payment-domain seed fixture (issue #42, SEED_VERSION 3).
 *
 * Extends the Hi-Fi card dataset with record-only payment data (EDR-010)
 * anchored to the same rendered date, 2026-07-11: scheduled payments across
 * the runway window, immutable statement records (EDR-015), one funding
 * account, and provider-autopay links (EDR-016 — feeds the PAY/AUTO chip).
 *
 * Cards are referenced by cardName (unique within SEED_CARDS — lastFour is
 * NEVER a key). Deliberate edge fixtures, in the dataset's own style:
 * - a DONE and a SKIPPED payment (runway must filter resolved rows)
 * - a payment with no funding account (fundingAccount is optional metadata)
 * - a statement with no minimum due (Horizon Cash records no minimum)
 * - an autopay link with autopayActive=false (link-out only, no AUTO chip)
 *
 * Imported by BOTH prisma/seed.ts and the conformance tests — the seed IS
 * the fixture. Change it and tests fail loudly.
 */

export interface SeedFinancialAccount {
  name: string
  institution: string | null
  accountType: "CHECKING" | "SAVINGS" | "OTHER"
  lastFour: string | null
}

export interface SeedScheduledPayment {
  cardName: string
  fundingAccountName: string | null
  amountMinor: bigint
  scheduledFor: string // ISO date, parsed at insert time
  status: "SCHEDULED" | "DONE" | "SKIPPED" | "CANCELED"
  resolvedAt: string | null // ISO date; set iff status has left SCHEDULED
  note?: string
}

export interface SeedStatement {
  cardName: string
  periodStart: string | null
  closingDate: string
  dueDate: string | null
  statementBalanceMinor: bigint
  minimumDueMinor: bigint | null
}

export interface SeedAutopayLink {
  cardName: string
  providerUrl: string | null
  autopayActive: boolean
  note?: string
}

export const SEED_FINANCIAL_ACCOUNTS: SeedFinancialAccount[] = [
  { name: "Household Checking", institution: "First Federal", accountType: "CHECKING", lastFour: "4411" },
]

export const SEED_SCHEDULED_PAYMENTS: SeedScheduledPayment[] = [
  // Resolved history (before the 2026-07-11 anchor)
  { cardName: "Quill Rewards", fundingAccountName: "Household Checking", amountMinor: 12692n, scheduledFor: "2026-07-09", status: "DONE", resolvedAt: "2026-07-09" },
  { cardName: "Fern Cash", fundingAccountName: "Household Checking", amountMinor: 3500n, scheduledFor: "2026-07-19", status: "SKIPPED", resolvedAt: "2026-07-10", note: "Paid in store instead" },
  // Upcoming inside the 45-day runway window
  { cardName: "Meridian Blue", fundingAccountName: "Household Checking", amountMinor: 8500n, scheduledFor: "2026-07-22", status: "SCHEDULED", resolvedAt: null },
  { cardName: "Beacon Everyday", fundingAccountName: null, amountMinor: 5500n, scheduledFor: "2026-07-27", status: "SCHEDULED", resolvedAt: null },
  { cardName: "Cascade Platinum", fundingAccountName: "Household Checking", amountMinor: 211700n, scheduledFor: "2026-08-01", status: "SCHEDULED", resolvedAt: null, note: "Promo payoff installment" },
]

export const SEED_STATEMENTS: SeedStatement[] = [
  // Statement balance differs from current balance — normal drift since close
  { cardName: "Horizon Cash", periodStart: "2026-05-10", closingDate: "2026-06-09", dueDate: "2026-07-04", statementBalanceMinor: 798500n, minimumDueMinor: null },
  { cardName: "Meridian Blue", periodStart: "2026-05-28", closingDate: "2026-06-27", dueDate: "2026-07-22", statementBalanceMinor: 214000n, minimumDueMinor: 8500n },
  { cardName: "Quill Rewards", periodStart: "2026-05-15", closingDate: "2026-06-14", dueDate: "2026-07-09", statementBalanceMinor: 68667n, minimumDueMinor: 12692n },
]

export const SEED_AUTOPAY_LINKS: SeedAutopayLink[] = [
  { cardName: "Beacon Everyday", providerUrl: "https://www.wellsfargo.com/pay", autopayActive: true, note: "Minimum on due date" },
  { cardName: "Summit Travel", providerUrl: "https://www.chase.com/pay", autopayActive: false },
]
