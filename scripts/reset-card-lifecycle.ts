/**
 * Reset the demo household's cards to ACTIVE lifecycle (issue #27).
 *
 *   pnpm exec tsx scripts/reset-card-lifecycle.ts
 *
 * The freeze-card e2e spec flips cards to FROZEN. The seed sets every card
 * ACTIVE, but a REUSED dev server never re-seeds — so the spec calls this
 * before AND after the run to restore the ACTIVE fixture other specs assert
 * against, even if a test fails mid-way. Scoped by demo membership (never a
 * lastFour — those are not keys).
 */
import { PrismaClient } from "@prisma/client"

const DEMO_EMAIL = "demo@glidepath.cards"

const prisma = new PrismaClient()

async function main() {
  try {
    const res = await prisma.creditCard.updateMany({
      where: { household: { members: { some: { user: { email: DEMO_EMAIL } } } } },
      data: { lifecycle: "ACTIVE" },
    })
    console.log(`Reset ${res.count} cards to ACTIVE.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
