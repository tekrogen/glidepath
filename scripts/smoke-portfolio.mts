// One-shot smoke: repository + service against the seeded DB.
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo@creditcardmanager.app" } })
const { getCardPortfolio } = await import("../src/features/cards/server/service")
const p = await getCardPortfolio(user.id, new Date(Date.UTC(2026, 6, 11)))
const fmt = (m: bigint) => `$${(Number(m) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
console.log(`cards: ${p.cards.length}`)
console.log(`total balance: ${fmt(p.summary.totalBalanceMinor)} of ${fmt(p.summary.totalLimitMinor)}`)
console.log(`min payments/mo: ${fmt(p.summary.totalMinimumPaymentsMinor)}  est interest: ~${fmt(p.summary.estMonthlyInterestMinor)}`)
console.log(`top paydown: ${p.cards[0].cardName} badge=${p.cards[0].statusBadge} owner=${p.cards[0].ownerLabel ?? "shared"}`)
console.log(`promo plans: ${p.promoPlans.length}, most urgent daysLeft=${p.promoPlans[0].daysLeft}`)
await prisma.$disconnect()
