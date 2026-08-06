/**
 * Scratch check (walkthrough support, 2026-07-25): recompute the Overview
 * metric-grid figures from the live seeded DB through the SAME path the page
 * uses (toFinanceCard → portfolioSummary) and print them for comparison with
 * the v1.2.0 walkthrough's §C expected values. Read-only.
 *
 *   pnpm qa:overview
 */
import { PrismaClient } from "@prisma/client"

import { DEMO_USER } from "../../src/lib/auth/providers"
import { toFinanceCard } from "../../src/features/cards/server/mappers"
import { portfolioSummary } from "../../src/lib/finance"
import { formatMinor, formatShortDate } from "../../src/lib/formatting"

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.creditCard.findMany({
    where: {
      household: { members: { some: { user: { email: DEMO_USER.email } } } },
    },
    include: { promoPeriods: { where: { status: "ACTIVE" } } },
  })
  const summary = portfolioSummary(rows.map(toFinanceCard), new Date())
  console.log(`cards: ${rows.length}`)
  console.log(`total balance: ${formatMinor(summary.totalBalanceMinor)} of ${formatMinor(summary.totalLimitMinor)}`)
  console.log(`overall utilization pct (x100): ${summary.overallUtilization}`)
  console.log(`est monthly interest: ${formatMinor(summary.estMonthlyInterestMinor)}`)
  console.log(`sheltered: ${formatMinor(summary.shelteredMinor)} across ${summary.shelteredCardCount} cards`)
  console.log(`next 0% ends: ${summary.nextPromoExpiration ? formatShortDate(summary.nextPromoExpiration) : "—"}`)
  console.log(`min payments/mo: ${formatMinor(summary.totalMinimumPaymentsMinor)}`)
  console.log(`available credit: ${formatMinor(summary.availableCreditMinor)}`)
}

main().finally(() => prisma.$disconnect())
