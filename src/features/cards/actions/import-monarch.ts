"use server"

/**
 * Monarch balances import server actions (issue #48) — the #28 template
 * over the monarch core (monarch-csv → monarch-import → commit):
 * `previewMonarchImport` parses the uploaded CSV into the match plan the
 * wizard shows; `confirmMonarchImport` RE-parses the same bytes and
 * RECOMPUTES the whole plan server-side (the client preview is never
 * trusted for amounts or auto-matches), overlays the user's resolutions,
 * and commits update-only through one transaction. Ambiguous rows left
 * unresolved are an ERROR, never a silent skip. Monetary mutation →
 * pending UI, no optimistic update.
 */
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { prisma } from "@/lib/db/prisma"
import { emitDomainEvent } from "@/server/events/publishers"
import {
  MonarchCsvFormatError,
  parseMonarchBalancesCsv,
  type MonarchBalanceRow,
} from "@/features/cards/server/monarch-csv"
import {
  aggregateSnapshots,
  matchSnapshots,
  type MatchableCard,
  type MatchStatus,
  type MonarchMatchPlan,
} from "@/features/cards/server/monarch-import"
import {
  commitMonarchImport,
  type MonarchImportCardOutcome,
  type ResolvedMonarchUpdate,
} from "@/features/cards/server/monarch-import-commit"

/** Serialized entry — cents as number, bigint never crosses RSC. */
export interface MonarchPreviewEntry {
  accountKey: string
  displayName: string
  suffix: string | null
  status: MatchStatus
  cardId: string | null
  rankedCandidateIds: string[]
  owedCents: number
  asOf: string
  stale: boolean
  creditBalanceClamped: boolean
  warnings: string[]
}

export interface MonarchPickerCard {
  id: string
  cardName: string
  issuer: string
  lastFour: string | null
  balanceCents: number
  currency: string
}

export type PreviewMonarchState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      fileName: string
      asOfDate: string
      entries: MonarchPreviewEntry[]
      pickerCards: MonarchPickerCard[]
      cardsNotInFile: MonarchPickerCard[]
      parseWarnings: string[]
      totalWarnings: number
    }

export type ConfirmMonarchState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done"
      asOfDate: string
      updated: number
      changed: number
      mappingsSaved: number
      skippedCount: number
      unmatchedCount: number
      cards: MonarchImportCardOutcome[]
    }

// Real fixture ≈ 280 KB (7 months × 31 accounts) — 1 MB gives ~2 years of
// headroom before "export a shorter date range" friction. Mirrored
// client-side for a friendly message (the tracker constant-pair idiom).
const MAX_UPLOAD_BYTES = 1024 * 1024

/** Rows the user touched or that needed a choice: cardId null = explicit skip. */
const resolutionsSchema = z.array(
  z.object({ accountKey: z.string().min(1), cardId: z.string().min(1).nullable() })
)

async function readUpload(
  formData: FormData
): Promise<
  | { ok: true; fileName: string; rows: MonarchBalanceRow[]; warnings: string[] }
  | { ok: false; message: string }
> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a Monarch balances export (.csv) to import." }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: "That file is too large — export a shorter date range from Monarch.",
    }
  }
  let parsed
  try {
    const text = new TextDecoder("utf-8").decode(await file.arrayBuffer())
    parsed = parseMonarchBalancesCsv(text)
  } catch (error) {
    if (error instanceof MonarchCsvFormatError) return { ok: false, message: error.message }
    console.error("monarch upload parse failed:", error)
    return { ok: false, message: "That file couldn't be read as a CSV." }
  }
  if (parsed.rows.length === 0) {
    return { ok: false, message: "No balance rows found in that export." }
  }
  return { ok: true, fileName: file.name, rows: parsed.rows, warnings: parsed.warnings }
}

/** The household's cards in matcher shape; null when the user has no household. */
async function findMatchableCards(userId: string): Promise<MatchableCard[] | null> {
  const member = await prisma.householdMember.findFirst({
    where: { userId },
    select: { householdId: true },
  })
  if (!member) return null
  const cards = await prisma.creditCard.findMany({
    where: { householdId: member.householdId },
    select: {
      id: true,
      cardName: true,
      issuer: true,
      lastFour: true,
      currency: true,
      monarchAccountKey: true,
      currentBalanceMinor: true,
    },
    orderBy: [{ cardName: "asc" }],
  })
  return cards
}

function buildPlan(rows: MonarchBalanceRow[], cards: MatchableCard[]): MonarchMatchPlan {
  const { snapshots } = aggregateSnapshots(rows)
  return matchSnapshots(snapshots, cards)
}

const toPickerCard = (c: MatchableCard): MonarchPickerCard => ({
  id: c.id,
  cardName: c.cardName,
  issuer: c.issuer,
  lastFour: c.lastFour,
  balanceCents: Number(c.currentBalanceMinor),
  currency: c.currency,
})

export async function previewMonarchImport(
  _prev: PreviewMonarchState,
  formData: FormData
): Promise<PreviewMonarchState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { status: "error", message: "Not authorized." }
  }
  const read = await readUpload(formData)
  if (!read.ok) return { status: "error", message: read.message }

  const cards = await findMatchableCards(session.user.id)
  if (!cards || cards.length === 0) {
    return {
      status: "error",
      message: "Import your cards first — this file only carries balances.",
    }
  }

  const plan = buildPlan(read.rows, cards)
  const entries: MonarchPreviewEntry[] = plan.entries.map((e) => ({
    accountKey: e.snapshot.accountKey,
    displayName: e.snapshot.displayName,
    suffix: e.snapshot.suffix,
    status: e.status,
    cardId: e.cardId,
    rankedCandidateIds: e.rankedCandidateIds,
    owedCents: Number(e.owedMinor),
    asOf: e.snapshot.latestDate,
    stale: e.snapshot.stale,
    creditBalanceClamped: e.creditBalanceClamped,
    warnings: e.warnings,
  }))
  const totalWarnings =
    read.warnings.length + entries.reduce((sum, e) => sum + e.warnings.length, 0)
  return {
    status: "ready",
    fileName: read.fileName,
    asOfDate: plan.asOfDate ?? "",
    entries,
    pickerCards: cards.map(toPickerCard),
    cardsNotInFile: plan.cardsNotInFile.map(toPickerCard),
    parseWarnings: read.warnings,
    totalWarnings,
  }
}

export async function confirmMonarchImport(
  _prev: ConfirmMonarchState,
  formData: FormData
): Promise<ConfirmMonarchState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { status: "error", message: "Not authorized." }
  }

  // Re-parse the actual bytes and recompute the plan — client state is
  // display-only, resolutions are the ONLY client input honored.
  const read = await readUpload(formData)
  if (!read.ok) return { status: "error", message: read.message }

  const rawResolutions = formData.get("resolutions")
  let resolutions: Map<string, string | null>
  try {
    const parsed = resolutionsSchema.parse(
      JSON.parse(typeof rawResolutions === "string" && rawResolutions !== "" ? rawResolutions : "[]")
    )
    resolutions = new Map(parsed.map((r) => [r.accountKey, r.cardId]))
  } catch {
    return { status: "error", message: "The match choices couldn't be read — nothing was changed." }
  }

  const cards = await findMatchableCards(session.user.id)
  if (!cards || cards.length === 0) {
    return { status: "error", message: "Import your cards first — this file only carries balances." }
  }
  const cardIds = new Set(cards.map((c) => c.id))
  const byId = new Map(cards.map((c) => [c.id, c]))

  const plan = buildPlan(read.rows, cards)
  const knownKeys = new Set(plan.entries.map((e) => e.snapshot.accountKey))
  for (const key of resolutions.keys()) {
    if (!knownKeys.has(key)) {
      return { status: "error", message: "A match choice referenced an unknown account — nothing was changed." }
    }
  }

  const updates: ResolvedMonarchUpdate[] = []
  let skipped = 0
  let unmatched = 0
  for (const entry of plan.entries) {
    const resolved = resolutions.has(entry.snapshot.accountKey)
      ? resolutions.get(entry.snapshot.accountKey)!
      : entry.cardId // remembered/suggested proceed; others default null
    if (resolved == null) {
      if (entry.status === "ambiguous") {
        // Unresolved ambiguity is an ERROR unless the user explicitly
        // skipped it (an explicit skip IS a resolutions entry with null).
        if (!resolutions.has(entry.snapshot.accountKey)) {
          return {
            status: "error",
            message: `"${entry.snapshot.accountKey}" matches more than one card — pick one or skip it, then confirm again. Nothing was changed.`,
          }
        }
        skipped++
      } else if (entry.status === "unmatched") unmatched++
      else skipped++
      continue
    }
    if (!cardIds.has(resolved)) {
      return { status: "error", message: "A match choice referenced an unknown card — nothing was changed." }
    }
    if (byId.get(resolved)!.currency !== "USD") {
      return {
        status: "error",
        message: "A chosen card isn't USD-denominated — its balance can't be imported. Nothing was changed.",
      }
    }
    updates.push({
      cardId: resolved,
      accountKey: entry.snapshot.accountKey,
      owedMinor: entry.owedMinor,
      asOfDate: entry.snapshot.latestDate,
    })
  }
  if (updates.length === 0) {
    return { status: "error", message: "Nothing is linked to a card — pick at least one match to import." }
  }

  let result
  try {
    result = await commitMonarchImport(prisma, updates, { userId: session.user.id })
  } catch (error) {
    console.error("confirmMonarchImport failed:", error)
    return { status: "error", message: "The import could not be completed — nothing was changed." }
  }

  await emitDomainEvent({
    type: "MonarchBalancesImported",
    userId: session.user.id,
    householdId: result.householdId,
    asOfDate: plan.asOfDate ?? "",
    updated: result.updated,
    changed: result.changed,
    mappingsSaved: result.mappingsSaved,
    skippedAccounts: skipped,
    unmatchedAccounts: unmatched,
  })

  revalidatePath("/cards")
  revalidatePath("/overview")
  return {
    status: "done",
    asOfDate: plan.asOfDate ?? "",
    updated: result.updated,
    changed: result.changed,
    mappingsSaved: result.mappingsSaved,
    skippedCount: skipped,
    unmatchedCount: unmatched,
    cards: result.cards,
  }
}
