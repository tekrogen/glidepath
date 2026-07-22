/**
 * Remove the payment-stepper e2e spec's rows (issue #45).
 *
 *   pnpm exec tsx scripts/e2e-stepper-cleanup.ts
 *
 * Deletes the demo household's stepper-created ScheduledPayments (tagged
 * by note) and ALL of its PaymentIntents — drafts are ephemeral by design
 * and the demo household is the test fixture, so wiping its intents is
 * safe and keeps reused dev DBs clean for seed-exact specs. Payments
 * first: deleting a SUBMITTED intent SetNulls its payment's intentId,
 * never the payment itself (EDR-010 history).
 */
import { PrismaClient } from "@prisma/client"

const DEMO_EMAIL = "demo@glidepath.cards"
const NOTE = "E2E-STEPPER"

const prisma = new PrismaClient()

async function main() {
  try {
    const demoScope = {
      household: { members: { some: { user: { email: DEMO_EMAIL } } } },
    }
    const payments = await prisma.scheduledPayment.deleteMany({
      where: { note: NOTE, card: demoScope },
    })
    const intents = await prisma.paymentIntent.deleteMany({
      where: demoScope,
    })
    console.log(`Deleted ${payments.count} stepper payment(s), ${intents.count} intent(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
