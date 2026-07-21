/**
 * Insert / remove the reschedule e2e spec's temporary ScheduledPayment
 * (issue #44).
 *
 *   pnpm exec tsx scripts/e2e-scheduled-payment.ts create
 *   pnpm exec tsx scripts/e2e-scheduled-payment.ts delete
 *
 * The seed's own SCHEDULED rows are pinned to the fixture's 2026-07-11
 * anchor and age out of the 45-day window, so the spec inserts its own
 * row at today+10 — a unique $42.00 amount, tagged by note — and removes
 * it afterward, leaving the fixture untouched for seed-exact specs.
 * Scoped by demo membership + card name (never a lastFour — not a key).
 */
import { PrismaClient } from "@prisma/client"

const DEMO_EMAIL = "demo@glidepath.cards"
const CARD_NAME = "Meridian Blue"
const NOTE = "E2E-RESCHEDULE"
const AMOUNT_MINOR = 4200n

const prisma = new PrismaClient()

async function main() {
  const command = process.argv[2]
  try {
    if (command === "create") {
      const card = await prisma.creditCard.findFirst({
        where: {
          cardName: CARD_NAME,
          household: { members: { some: { user: { email: DEMO_EMAIL } } } },
        },
        select: { id: true },
      })
      if (!card) throw new Error(`Card "${CARD_NAME}" not found for the demo household`)
      // Leftover from an aborted run must not duplicate. Scoped to the demo
      // household, never note-text alone (review finding).
      await prisma.scheduledPayment.deleteMany({
        where: {
          note: NOTE,
          card: { household: { members: { some: { user: { email: DEMO_EMAIL } } } } },
        },
      })
      const now = new Date()
      const scheduledFor = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10)
      )
      const row = await prisma.scheduledPayment.create({
        data: {
          cardId: card.id,
          amountMinor: AMOUNT_MINOR,
          scheduledFor,
          status: "SCHEDULED",
          note: NOTE,
        },
        select: { id: true, scheduledFor: true },
      })
      console.log(`Created ${row.id} for ${row.scheduledFor.toISOString().slice(0, 10)}`)
    } else if (command === "delete") {
      const res = await prisma.scheduledPayment.deleteMany({
        where: {
          note: NOTE,
          card: { household: { members: { some: { user: { email: DEMO_EMAIL } } } } },
        },
      })
      console.log(`Deleted ${res.count} e2e payment(s).`)
    } else {
      throw new Error(`Usage: e2e-scheduled-payment.ts create|delete (got "${command}")`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
