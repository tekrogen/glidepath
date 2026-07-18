/**
 * QA renderer (issue #43): prints the runway + debt-free projections the
 * engines produce from the SEED_VERSION 3 fixture, as a human-readable
 * record for admin/internal/reviews/. Read-only; no DB.
 *
 *   pnpm exec tsx scripts/qa/render-runway.ts
 */
import {
  debtFreePlan,
  runwayAggregate,
  type Minor,
  type RunwayCard,
  type RunwayPayment,
} from "../../src/lib/finance"
import { SEED_CARDS } from "../../prisma/seed-data/glidepath-cards"
import { SEED_SCHEDULED_PAYMENTS } from "../../prisma/seed-data/glidepath-payments"

const TODAY = new Date(Date.UTC(2026, 6, 11))
const formatMinorForQa = (m: Minor) =>
  `$${(Number(m) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`

const utc = (s: string) => new Date(`${s}T00:00:00Z`)
const day = (d: Date) => d.toISOString().slice(0, 10)

const cards: RunwayCard[] = SEED_CARDS.map((c) => ({
  id: c.cardName,
  balanceMinor: c.currentBalanceMinor,
  limitMinor: c.creditLimitMinor,
  regularAprBps: c.regularAprBps,
  minimumPaymentMinor: c.minimumPaymentMinor,
  promo: c.promo
    ? { endsOn: utc(c.promo.endsOn), shelteredBalanceMinor: c.currentBalanceMinor, regularAprBpsAfter: c.promo.regularAprBpsAfter }
    : null,
  paymentDueDay: c.paymentDueDay,
  statementCloseDay: null,
}))
const payments: RunwayPayment[] = SEED_SCHEDULED_PAYMENTS.map((p, i) => ({
  id: `seed-${i}`,
  cardId: p.cardName,
  amountMinor: p.amountMinor,
  scheduledFor: utc(p.scheduledFor),
  status: p.status,
}))

const agg = runwayAggregate(cards, payments, TODAY)
const fmt = formatMinorForQa

console.log(`PAYMENT RUNWAY — NEXT ${agg.horizonDays} DAYS (${day(TODAY)} → ${day(agg.horizonEnd)})`)
console.log(`TOTAL CASH NEEDED: ${fmt(agg.totalCashNeededMinor)}\n`)

console.log("CARD LANES (cards with events):")
for (const lane of agg.lanes) {
  if (lane.events.length === 0) continue
  const util = lane.utilization == null ? "—" : `${(lane.utilization * 100).toFixed(1)}%`
  console.log(`  ${lane.cardId}  (${fmt(lane.balanceMinor)} · ${util})`)
  for (const e of lane.events) {
    const tag =
      e.kind === "scheduled"
        ? `SCHEDULED ${fmt(e.amountMinor!)}`
        : e.kind === "due"
          ? `DUE ${e.amountMinor == null ? "(no min recorded)" : fmt(e.amountMinor)}${e.covered ? " · covered by scheduled payment" : ""}`
          : "CLOSE"
    console.log(`      ${day(e.date)}  ${tag}`)
  }
}

console.log("\nCASH NEEDED / WEEK:")
for (const w of agg.weeks) {
  const bar = "█".repeat(Number(w.cashNeededMinor / 2000n))
  console.log(`  wk${w.index} (${day(w.startsOn)})  ${fmt(w.cashNeededMinor).padStart(10)}  ${bar}`)
}

for (const strategy of ["avalanche", "snowball"] as const) {
  const plan = debtFreePlan(cards, strategy, 200000n, TODAY)!
  console.log(`\nPAYOFF PLAN — ${strategy.toUpperCase()} @ $2,000/mo → DEBT-FREE ${day(plan.debtFreeDate)} (${plan.months} months)`)
  for (const s of plan.steps) console.log(`  ${String(s.payoffMonths).padStart(2)} mo  ${day(s.payoffDate)}  ${s.cardId}`)
}
