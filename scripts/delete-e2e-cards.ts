/**
 * Delete cards created by the add-card e2e spec (issue #26).
 *
 *   pnpm exec tsx scripts/delete-e2e-cards.ts [prefix]
 *
 * The add-card flow inserts a real row per run; the seed wipes cards on
 * every db:seed, but a REUSED dev server never re-seeds — so the spec
 * calls this to stay hermetic. Deletion matches the caller's name prefix
 * (default "E2E "; import-tracker.spec passes its disjoint "E2EIMP " so
 * parallel mutation specs never delete each other's in-flight fixtures).
 * Never a lastFour — those are not keys.
 */
import { PrismaClient } from "@prisma/client"

const E2E_CARD_PREFIX = process.argv[2] ?? "E2E "

const prisma = new PrismaClient()

async function main() {
  try {
    const res = await prisma.creditCard.deleteMany({
      where: { cardName: { startsWith: E2E_CARD_PREFIX } },
    })
    console.log(`Deleted ${res.count} e2e test cards.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
