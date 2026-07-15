/**
 * Tracker import (Blueprint F16 / EDR-021 — issue #3).
 *
 *   pnpm import:cards [--file <xlsx>] [--email <user>] [--household <name>]
 *                     [--replace] [--dry-run]
 *
 * Reads the origin tracker workbook ("Card Tracker" sheet, rows 6–25),
 * maps rows through the pure parser in features/cards/server/tracker-import,
 * prints a per-row report (nothing is guessed silently — Gap G14), and
 * idempotently upserts household members, cards, and promo periods.
 *
 * The workbook read and the Prisma writes are shared with the upload UI
 * (issue #28) — see features/cards/server/tracker-workbook and
 * features/cards/server/tracker-import-commit. This CLI is a thin driver.
 *
 * Match key for re-runs: (household, cardName, issuer, lastFour) — NEVER
 * last-four alone; real portfolios contain duplicates.
 */
import { readFile } from "node:fs/promises"

import { PrismaClient } from "@prisma/client"

import { parseTrackerRow, type ParsedTrackerCard } from "../src/features/cards/server/tracker-import"
import { parseTrackerWorkbook } from "../src/features/cards/server/tracker-workbook"
import { commitTrackerImport } from "../src/features/cards/server/tracker-import-commit"

const DEFAULTS = {
  file: "admin/internal/planning/dolce_credit_card_tracker.xlsx",
  email: "demo@glidepath.cards",
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}
const flags = {
  file: arg("file") ?? DEFAULTS.file,
  email: arg("email") ?? DEFAULTS.email,
  household: arg("household"),
  replace: process.argv.includes("--replace"),
  dryRun: process.argv.includes("--dry-run"),
}

const fmt = (m: bigint | null) =>
  m == null ? "—" : `$${(Number(m) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`

async function main() {
  const buffer = await readFile(flags.file)
  const parsed = (await parseTrackerWorkbook(buffer))
    .map(parseTrackerRow)
    .filter((c): c is ParsedTrackerCard => c != null)

  console.log(`\nTracker import — ${flags.file}`)
  console.log(`Parsed ${parsed.length} cards${flags.dryRun ? " (dry run — no writes)" : ""}\n`)
  for (const c of parsed) {
    const owner = c.ownerLabel ?? "shared"
    const promo = c.promo ? ` · 0% until ${c.promo.endsOn.toISOString().slice(0, 10)}` : ""
    console.log(
      `  ${c.cardName} [${owner}] · ${c.issuer} ····${c.lastFour ?? "————"} · ` +
        `bal ${fmt(c.currentBalanceMinor)} of ${fmt(c.creditLimitMinor)}${promo}`
    )
    for (const w of c.warnings) console.log(`      ⚠ ${w}`)
  }

  const totalWarnings = parsed.reduce((s, c) => s + c.warnings.length, 0)
  console.log(`\n${parsed.length} cards, ${totalWarnings} warnings`)
  if (flags.dryRun) return

  const prisma = new PrismaClient()
  try {
    const user = await prisma.user.findUnique({ where: { email: flags.email } })
    if (!user) throw new Error(`No user with email ${flags.email} — sign in once first.`)

    const result = await commitTrackerImport(prisma, parsed, {
      userId: user.id,
      householdName: flags.household ?? undefined,
      replace: flags.replace,
    })

    if (flags.replace) {
      console.log(`--replace: removed ${result.removed} existing cards from "${result.householdName}"`)
    }
    console.log(
      `Imported into "${result.householdName}" for ${flags.email}: ${result.created} created, ${result.updated} updated.`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
