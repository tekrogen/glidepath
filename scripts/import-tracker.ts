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
 * Match key for re-runs: (household, cardName, issuer, lastFour) — NEVER
 * last-four alone; real portfolios contain duplicates.
 */
import { PrismaClient } from "@prisma/client"
import ExcelJS from "exceljs"

import {
  parseTrackerRow,
  type ParsedTrackerCard,
  type TrackerRow,
} from "../src/features/cards/server/tracker-import"

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

function cellString(v: ExcelJS.CellValue): string | null {
  if (v == null) return null
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("")
  return String(v)
}
function cellNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v
  return null
}
function cellDate(v: ExcelJS.CellValue): Date | null {
  return v instanceof Date ? v : null
}

async function readRows(file: string): Promise<TrackerRow[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.getWorksheet("Card Tracker")
  if (!ws) throw new Error(`Sheet "Card Tracker" not found in ${file}`)
  const rows: TrackerRow[] = []
  for (let r = 6; r <= 25; r++) {
    const row = ws.getRow(r)
    // Columns: B name · C last4 · D issuer · F balance · G available ·
    // I 0%? · J 0% end · L APR · N due day · O payment text · R notes
    rows.push({
      cardName: cellString(row.getCell("B").value),
      lastFour: cellString(row.getCell("C").value),
      issuer: cellString(row.getCell("D").value),
      currentBalance: cellNumber(row.getCell("F").value),
      availableCredit: cellNumber(row.getCell("G").value),
      hasIntroApr: cellString(row.getCell("I").value),
      introAprEndDate: cellDate(row.getCell("J").value),
      regularApr: cellNumber(row.getCell("L").value),
      paymentDueDay: cellNumber(row.getCell("N").value),
      paymentText: cellString(row.getCell("O").value),
      notes: cellString(row.getCell("R").value),
    })
  }
  return rows
}

const fmt = (m: bigint | null) =>
  m == null ? "—" : `$${(Number(m) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`

async function main() {
  const parsed = (await readRows(flags.file))
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

    const householdName =
      flags.household ?? `${(user.name ?? "My").split(" ")[0]} Household (imported)`
    let household = await prisma.household.findFirst({ where: { name: householdName } })
    household ??= await prisma.household.create({ data: { name: householdName } })

    // The importing user is always an OWNER member of the target household.
    const ownerName = user.name?.split(" ")[0] ?? "Owner"
    await prisma.householdMember.upsert({
      where: { householdId_displayName: { householdId: household.id, displayName: ownerName } },
      update: { userId: user.id, role: "OWNER" },
      create: { householdId: household.id, displayName: ownerName, userId: user.id, role: "OWNER" },
    })

    if (flags.replace) {
      const gone = await prisma.creditCard.deleteMany({ where: { householdId: household.id } })
      console.log(`--replace: removed ${gone.count} existing cards from "${householdName}"`)
    }

    let created = 0
    let updated = 0
    for (const c of parsed) {
      let memberId: string | null = null
      if (c.ownerLabel) {
        const member = await prisma.householdMember.upsert({
          where: {
            householdId_displayName: { householdId: household.id, displayName: c.ownerLabel },
          },
          update: {},
          create: { householdId: household.id, displayName: c.ownerLabel },
        })
        memberId = member.id
      }

      const data = {
        ownerMemberId: memberId,
        attribution: (c.ownerLabel ? "MEMBER" : "SHARED") as "MEMBER" | "SHARED",
        issuerKey: c.issuerKey,
        creditLimitMinor: c.creditLimitMinor,
        currentBalanceMinor: c.currentBalanceMinor,
        regularAprBps: c.regularAprBps,
        paymentDueDay: c.paymentDueDay,
        minimumPaymentMinor: c.minimumPaymentMinor,
        paymentNote: c.paymentNote,
        notes: c.notes,
        limitSource: (c.creditLimitMinor != null ? "MANUAL" : "UNKNOWN") as "MANUAL" | "UNKNOWN",
        aprSource: (c.regularAprBps != null || c.promo != null ? "MANUAL" : "UNKNOWN") as
          | "MANUAL"
          | "UNKNOWN",
        minimumSource: (c.minimumPaymentMinor != null ? "MANUAL" : "UNKNOWN") as
          | "MANUAL"
          | "UNKNOWN",
        syncStatus: "MANUAL" as const,
      }

      const existing = await prisma.creditCard.findFirst({
        where: {
          householdId: household.id,
          cardName: c.cardName,
          issuer: c.issuer,
          lastFour: c.lastFour,
        },
      })
      const card = existing
        ? await prisma.creditCard.update({ where: { id: existing.id }, data })
        : await prisma.creditCard.create({
            data: { ...data, householdId: household.id, cardName: c.cardName, issuer: c.issuer, lastFour: c.lastFour },
          })
      existing ? updated++ : created++

      await prisma.promoPeriod.deleteMany({ where: { cardId: card.id, status: "ACTIVE" } })
      if (c.promo) {
        await prisma.promoPeriod.create({
          data: {
            cardId: card.id,
            promoAprBps: 0,
            regularAprBpsAfter: c.promo.regularAprBpsAfter,
            endsOn: c.promo.endsOn,
            shelteredBalanceMinor: c.currentBalanceMinor,
            status: "ACTIVE",
          },
        })
      }
    }
    console.log(
      `Imported into "${householdName}" for ${flags.email}: ${created} created, ${updated} updated.`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
