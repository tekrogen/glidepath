/**
 * Provider-link fixture for design-QA captures (issue #46, DS-009).
 *
 *   pnpm exec tsx scripts/e2e-autopay-fixture.ts create
 *   pnpm exec tsx scripts/e2e-autopay-fixture.ts delete
 *
 * Adds providerUrl-only autopay links (autopayActive: false → the "Pay"
 * link-out state) to three demo cards whose due days (4, 15, 28) cover
 * every six-row widget window — so at least one Pay link is visible at
 * ANY capture date. None of the three carries a seed autopay link, and
 * Beacon/Summit are untouched. Demo-scoped both ways.
 */
import { PrismaClient } from "@prisma/client"

const DEMO_EMAIL = "demo@glidepath.cards"
const CARDS = ["Horizon Cash", "Juniper Retail", "Aspen One"]
const URL = "https://example.com/e2e-pay"

const prisma = new PrismaClient()

async function main() {
  const command = process.argv[2]
  try {
    const cards = await prisma.creditCard.findMany({
      where: {
        cardName: { in: CARDS },
        household: { members: { some: { user: { email: DEMO_EMAIL } } } },
      },
      select: { id: true, cardName: true },
    })
    if (command === "create") {
      for (const card of cards) {
        await prisma.providerAutopayLink.upsert({
          where: { cardId: card.id },
          create: { cardId: card.id, providerUrl: URL, autopayActive: false, note: "E2E-QA" },
          update: { providerUrl: URL, autopayActive: false, note: "E2E-QA" },
        })
      }
      console.log(`Linked ${cards.length} card(s) for QA capture.`)
    } else if (command === "delete") {
      const res = await prisma.providerAutopayLink.deleteMany({
        where: { note: "E2E-QA", cardId: { in: cards.map((c) => c.id) } },
      })
      console.log(`Deleted ${res.count} QA autopay link(s).`)
    } else {
      throw new Error(`Usage: e2e-autopay-fixture.ts create|delete (got "${command}")`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
