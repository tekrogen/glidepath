/**
 * Stale-draft fixture for the intent-expiry cron e2e (issue #46).
 *
 *   pnpm exec tsx scripts/e2e-intent-fixture.ts create-stale
 *   pnpm exec tsx scripts/e2e-intent-fixture.ts delete
 *
 * create-stale inserts a demo-household DRAFT whose expiresAt is an hour
 * in the past — exactly what the cron must flip to EXPIRED. Tagged by
 * note and demo-scoped both ways.
 */
import { PrismaClient } from "@prisma/client"

const DEMO_EMAIL = "demo@glidepath.cards"
const NOTE = "E2E-CRON"

const prisma = new PrismaClient()

async function main() {
  const command = process.argv[2]
  try {
    const demoHousehold = await prisma.household.findFirst({
      where: { members: { some: { user: { email: DEMO_EMAIL } } } },
      select: { id: true },
    })
    if (!demoHousehold) throw new Error("Demo household not found")

    if (command === "create-stale") {
      await prisma.paymentIntent.deleteMany({
        where: { note: NOTE, householdId: demoHousehold.id },
      })
      const row = await prisma.paymentIntent.create({
        data: {
          householdId: demoHousehold.id,
          note: NOTE,
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        },
        select: { id: true, expiresAt: true },
      })
      console.log(`Created stale draft ${row.id} (expired ${row.expiresAt.toISOString()})`)
    } else if (command === "delete") {
      const res = await prisma.paymentIntent.deleteMany({
        where: { note: NOTE, householdId: demoHousehold.id },
      })
      console.log(`Deleted ${res.count} cron fixture intent(s).`)
    } else {
      throw new Error(`Usage: e2e-intent-fixture.ts create-stale|delete (got "${command}")`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
