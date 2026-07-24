/**
 * Insert / remove the reschedule e2e spec's temporary ScheduledPayment
 * (issue #44).
 *
 *   pnpm exec tsx scripts/e2e-scheduled-payment.ts create [daysOut=10] [amountCents=4200] [tag=E2E-RESCHEDULE]
 *   pnpm exec tsx scripts/e2e-scheduled-payment.ts delete [tag=E2E-RESCHEDULE]
 *
 * Specs that run in parallel workers MUST use distinct amounts + tags —
 * chips are located by amount text and cleaned up by tag.
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
const DEFAULT_NOTE = "E2E-RESCHEDULE"

const prisma = new PrismaClient()

async function main() {
  const command = process.argv[2]
  try {
    const tag = (command === "create" ? process.argv[5] : process.argv[3]) ?? DEFAULT_NOTE
    if (command === "create") {
      const amountMinor = process.argv[4] ? BigInt(process.argv[4]) : 4200n
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
          note: tag,
          card: { household: { members: { some: { user: { email: DEMO_EMAIL } } } } },
        },
      })
      const daysOut = process.argv[3] ? Number(process.argv[3]) : 10
      if (!Number.isInteger(daysOut) || daysOut < 0 || daysOut > 44) {
        throw new Error(`daysOut must be an integer 0–44 (got "${process.argv[3]}")`)
      }
      const now = new Date()
      const scheduledFor = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysOut)
      )
      const row = await prisma.scheduledPayment.create({
        data: {
          cardId: card.id,
          amountMinor,
          scheduledFor,
          status: "SCHEDULED",
          note: tag,
        },
        select: { id: true, scheduledFor: true },
      })
      console.log(`Created ${row.id} for ${row.scheduledFor.toISOString().slice(0, 10)}`)
    } else if (command === "delete") {
      const res = await prisma.scheduledPayment.deleteMany({
        where: {
          note: tag,
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
