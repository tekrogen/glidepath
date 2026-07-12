/**
 * Reset the demo user's notifications (issue #25).
 *
 *   pnpm exec tsx scripts/reset-demo-notifications.ts [--email <user>]
 *
 * The Notification table holds the CURRENT attention occurrences with their
 * read/dismiss state; dismissed-while-active rows persist across runs by
 * design, so e2e runs against a long-lived reused dev server reset the
 * table explicitly to stay hermetic.
 */
import { PrismaClient } from "@prisma/client"

const DEMO_EMAIL = "demo@glidepath.cards"

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

const prisma = new PrismaClient()

async function main() {
  const email = arg("email") ?? DEMO_EMAIL
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) {
      console.log(`No user found for ${email} — nothing to reset.`)
      return
    }
    const res = await prisma.notification.deleteMany({ where: { userId: user.id } })
    console.log(`Deleted ${res.count} notifications for ${email}.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
