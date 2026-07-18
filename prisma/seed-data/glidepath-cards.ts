/**
 * Glidepath demo seed dataset (Blueprint EDR-018, SEED_VERSION 3).
 *
 * Source of truth: the Hi-Fi mockup's Cards table + Overview tiles as of
 * its rendered date, 2026-07-11. Cards 1–10 are the mockup's visible page;
 * cards 11–18 are the unseen page 2, engineered so the Overview tiles
 * reconcile EXACTLY: $43,969.72 balance of $215,850 limit (20.4%),
 * $572.92 min payments/mo, ~$311.41/mo est. interest, next 0% ends Oct 1.
 *
 * Known mockup deviation (documented, data wins): the Hi-Fi "available
 * credit" tile claims "$41,462 sheltered at 0% · 6 cards", but its own
 * cards table's six promos total $27,138.36 — the tiles here derive from
 * the data, so sheltered renders as $27,138.36 · 6 cards.
 *
 * This module is imported by BOTH prisma/seed.ts and the conformance
 * tests — the seed IS the fixture. Change it and tests fail loudly.
 *
 * v3 (issue #42): card figures unchanged; adds the payment-domain fixture
 * in ./glidepath-payments (scheduled payments, statements, autopay links).
 */

export const SEED_VERSION = 3

export const SEED_HOUSEHOLD = {
  name: "Dolce Household",
  members: [
    { displayName: "Marti", role: "OWNER" as const, isDemoUser: true },
    { displayName: "Bob", role: "MEMBER" as const, isDemoUser: false },
  ],
}

export interface SeedCard {
  cardName: string
  lastFour: string | null
  issuer: string
  issuerKey: string | null
  owner: "Marti" | "Bob" | null // null = shared
  cardType: "PERSONAL" | "BUSINESS"
  creditLimitMinor: bigint | null
  currentBalanceMinor: bigint
  regularAprBps: number | null
  paymentDueDay: number | null
  /** v3: set on the statement-bearing cards, aligned with their statement fixtures' closingDate. */
  statementCloseDay?: number
  minimumPaymentMinor: bigint | null
  promo: { endsOn: string; regularAprBpsAfter: number | null } | null // sheltered = full balance
  notes?: string
}

const d = (s: string) => s // ISO date strings, parsed at insert time

export const SEED_CARDS: SeedCard[] = [
  // ── Hi-Fi Cards table, page 1 (visible in the mockup) ──
  { cardName: "Horizon Cash", lastFour: "7727", issuer: "Chase", issuerKey: "chase", owner: null, cardType: "PERSONAL", creditLimitMinor: 1000000n, currentBalanceMinor: 809769n, regularAprBps: 2274, paymentDueDay: 4, statementCloseDay: 9, minimumPaymentMinor: null, promo: null },
  { cardName: "Cobalt One", lastFour: "9034", issuer: "Citibank", issuerKey: "citi", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 460000n, currentBalanceMinor: 316628n, regularAprBps: null, paymentDueDay: 5, minimumPaymentMinor: 3500n, promo: { endsOn: d("2027-09-05"), regularAprBpsAfter: 1990 } },
  { cardName: "Vertex Rewards", lastFour: "2210", issuer: "US Bank", issuerKey: "usbank", owner: "Bob", cardType: "PERSONAL", creditLimitMinor: 1000000n, currentBalanceMinor: 651300n, regularAprBps: null, paymentDueDay: 6, minimumPaymentMinor: 6500n, promo: { endsOn: d("2027-11-06"), regularAprBpsAfter: 2250 } },
  { cardName: "Atlas Flex", lastFour: "1652", issuer: "US Bank", issuerKey: "usbank", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 1300000n, currentBalanceMinor: 607888n, regularAprBps: null, paymentDueDay: 19, minimumPaymentMinor: 6100n, promo: { endsOn: d("2027-08-31"), regularAprBpsAfter: 2550 } },
  { cardName: "Beacon Everyday", lastFour: "5583", issuer: "Wells Fargo", issuerKey: "wellsfargo", owner: null, cardType: "PERSONAL", creditLimitMinor: 1200000n, currentBalanceMinor: 554500n, regularAprBps: 2349, paymentDueDay: 27, minimumPaymentMinor: 5500n, promo: null },
  { cardName: "Meridian Blue", lastFour: "4412", issuer: "USAA", issuerKey: "usaa", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 500000n, currentBalanceMinor: 214000n, regularAprBps: 1924, paymentDueDay: 22, statementCloseDay: 27, minimumPaymentMinor: 8500n, promo: null },
  { cardName: "Summit Travel", lastFour: "6076", issuer: "Chase", issuerKey: "chase", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 2280000n, currentBalanceMinor: 683805n, regularAprBps: null, paymentDueDay: 11, minimumPaymentMinor: 6800n, promo: { endsOn: d("2027-08-14"), regularAprBpsAfter: 2820 } },
  { cardName: "Cascade Platinum", lastFour: "0042", issuer: "USAA", issuerKey: "usaa", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 1500000n, currentBalanceMinor: 423400n, regularAprBps: null, paymentDueDay: 1, minimumPaymentMinor: 4200n, promo: { endsOn: d("2026-10-01"), regularAprBpsAfter: 1924 } },
  { cardName: "Juniper Retail", lastFour: "3308", issuer: "Citibank", issuerKey: "citi", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 320000n, currentBalanceMinor: 30815n, regularAprBps: null, paymentDueDay: 15, minimumPaymentMinor: null, promo: { endsOn: d("2027-04-15"), regularAprBpsAfter: 1850 }, notes: "No minimum recorded — add it to see whether you're on track." },
  { cardName: "Fern Cash", lastFour: "8391", issuer: "Capital One", issuerKey: "capitalone", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 975000n, currentBalanceMinor: 36200n, regularAprBps: 1340, paymentDueDay: 19, minimumPaymentMinor: 3500n, promo: null },

  // ── Page 2 (engineered to reconcile the Overview tiles exactly) ──
  { cardName: "Harbor Business", lastFour: "0037", issuer: "Chase", issuerKey: "chase", owner: null, cardType: "BUSINESS", creditLimitMinor: 2600000n, currentBalanceMinor: 0n, regularAprBps: 2724, paymentDueDay: 18, minimumPaymentMinor: null, promo: null },
  { cardName: "Aspen One", lastFour: "4114", issuer: "Capital One", issuerKey: "capitalone", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 650000n, currentBalanceMinor: 0n, regularAprBps: 2649, paymentDueDay: 28, minimumPaymentMinor: null, promo: null },
  { cardName: "Orchard Card", lastFour: "4969", issuer: "Apple", issuerKey: "apple", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 550000n, currentBalanceMinor: 0n, regularAprBps: 2549, paymentDueDay: 30, minimumPaymentMinor: null, promo: null },
  { cardName: "Pinnacle Visa", lastFour: "6209", issuer: "Wells Fargo", issuerKey: "wellsfargo", owner: "Bob", cardType: "PERSONAL", creditLimitMinor: 240000n, currentBalanceMinor: 0n, regularAprBps: 2500, paymentDueDay: 15, minimumPaymentMinor: null, promo: null },
  // Duplicate last4 with Horizon Cash — deliberate real-data fixture (never key on last4)
  { cardName: "Cedar Line", lastFour: "7727", issuer: "Ally", issuerKey: "ally", owner: null, cardType: "PERSONAL", creditLimitMinor: 550000n, currentBalanceMinor: 0n, regularAprBps: 2780, paymentDueDay: null, minimumPaymentMinor: null, promo: null },
  // Missing last4 + unknown APR — deliberate real-data fixtures
  { cardName: "Sterling Simplicity", lastFour: null, issuer: "Citibank", issuerKey: "citi", owner: "Marti", cardType: "PERSONAL", creditLimitMinor: 2000000n, currentBalanceMinor: 0n, regularAprBps: null, paymentDueDay: null, minimumPaymentMinor: null, promo: null },
  { cardName: "Coastal CU", lastFour: null, issuer: "Space Coast", issuerKey: null, owner: null, cardType: "PERSONAL", creditLimitMinor: 2000000n, currentBalanceMinor: 0n, regularAprBps: null, paymentDueDay: null, minimumPaymentMinor: null, promo: null },
  { cardName: "Quill Rewards", lastFour: "3303", issuer: "US Bank", issuerKey: "usbank", owner: "Bob", cardType: "PERSONAL", creditLimitMinor: 2460000n, currentBalanceMinor: 68667n, regularAprBps: 1935, paymentDueDay: 9, statementCloseDay: 14, minimumPaymentMinor: 12692n, promo: null },
]
