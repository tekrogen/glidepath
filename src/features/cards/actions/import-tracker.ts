"use server"

/**
 * Tracker-import server actions (issue #28, EDR-021 step 2).
 *
 * Two server-confirmed steps over the shared core (tracker-workbook +
 * tracker-import-commit): `previewTrackerImport` parses the uploaded xlsx
 * into a read-only mapping the wizard shows for confirmation (nothing is
 * guessed silently — Gap G14), and `confirmTrackerImport` RE-parses the
 * same bytes on the server (never trusting the client preview) and commits
 * through the exact path `pnpm import:cards` uses, then audits via the
 * TrackerImported event. Monetary mutation → pending UI, no optimistic update.
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { prisma } from "@/lib/db/prisma"
import { emitDomainEvent } from "@/server/events/publishers"
import { parseTrackerRow, type ParsedTrackerCard } from "@/features/cards/server/tracker-import"
import {
  parseTrackerWorkbook,
  TrackerSheetMissingError,
} from "@/features/cards/server/tracker-workbook"
import {
  commitTrackerImport,
  type TrackerImportCardOutcome,
} from "@/features/cards/server/tracker-import-commit"

/** One mapped card, serialized for the client (cents as number — bigint can't cross RSC). */
export interface TrackerPreviewCard {
  cardName: string
  ownerLabel: string | null
  lastFour: string | null
  issuer: string
  issuerKey: string | null
  creditLimitCents: number | null
  currentBalanceCents: number
  regularAprBps: number | null
  paymentDueDay: number | null
  minimumPaymentCents: number | null
  paymentNote: string | null
  notes: string | null
  promo: { endsOn: string; regularAprBpsAfter: number | null } | null
  warnings: string[]
}

export type PreviewTrackerState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; fileName: string; cards: TrackerPreviewCard[]; totalWarnings: number }

export type ConfirmTrackerState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done"
      householdName: string
      created: number
      updated: number
      cards: TrackerImportCardOutcome[]
    }

// Real trackers are ~17 KB. 1 MB matches Next's server-action body limit —
// anything larger dies at the transport before this guard, so the wizard
// checks the same limit client-side for a friendly message.
const MAX_UPLOAD_BYTES = 1024 * 1024

function toPreviewCard(c: ParsedTrackerCard): TrackerPreviewCard {
  return {
    cardName: c.cardName,
    ownerLabel: c.ownerLabel,
    lastFour: c.lastFour,
    issuer: c.issuer,
    issuerKey: c.issuerKey,
    creditLimitCents: c.creditLimitMinor != null ? Number(c.creditLimitMinor) : null,
    currentBalanceCents: Number(c.currentBalanceMinor),
    regularAprBps: c.regularAprBps,
    paymentDueDay: c.paymentDueDay,
    minimumPaymentCents: c.minimumPaymentMinor != null ? Number(c.minimumPaymentMinor) : null,
    paymentNote: c.paymentNote,
    notes: c.notes,
    promo: c.promo
      ? { endsOn: c.promo.endsOn.toISOString(), regularAprBpsAfter: c.promo.regularAprBpsAfter }
      : null,
    warnings: c.warnings,
  }
}

/** Read + validate the uploaded xlsx, returning parsed cards or a user-facing message. */
async function readUpload(
  formData: FormData
): Promise<{ ok: true; fileName: string; cards: ParsedTrackerCard[] } | { ok: false; message: string }> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a tracker workbook (.xlsx) to import." }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "That file is too large to be a card tracker." }
  }

  let rows
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    rows = await parseTrackerWorkbook(buffer)
  } catch (error) {
    if (error instanceof TrackerSheetMissingError) return { ok: false, message: error.message }
    console.error("tracker upload parse failed:", error)
    return { ok: false, message: "That file couldn't be read as an xlsx workbook." }
  }

  const cards = rows.map(parseTrackerRow).filter((c): c is ParsedTrackerCard => c != null)
  if (cards.length === 0) {
    return { ok: false, message: "No cards found in rows 6–25 of the “Card Tracker” sheet." }
  }
  return { ok: true, fileName: file.name, cards }
}

export async function previewTrackerImport(
  _prev: PreviewTrackerState,
  formData: FormData
): Promise<PreviewTrackerState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { status: "error", message: "Not authorized." }
  }

  const read = await readUpload(formData)
  if (!read.ok) return { status: "error", message: read.message }

  const cards = read.cards.map(toPreviewCard)
  // In-file duplicates collapse onto one card at import (idempotent match
  // key) — say so instead of letting the later row win silently (G14).
  const seen = new Set<string>()
  for (const c of cards) {
    const key = `${c.cardName}|${c.issuer}|${c.lastFour ?? ""}`
    if (seen.has(key)) {
      c.warnings.push(
        "duplicate of an earlier row (same name, issuer, and last four) — this row overwrites it on import"
      )
    } else {
      seen.add(key)
    }
  }
  const totalWarnings = cards.reduce((sum, c) => sum + c.warnings.length, 0)
  return { status: "ready", fileName: read.fileName, cards, totalWarnings }
}

export async function confirmTrackerImport(
  _prev: ConfirmTrackerState,
  formData: FormData
): Promise<ConfirmTrackerState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { status: "error", message: "Not authorized." }
  }

  // Re-parse the actual bytes server-side — the preview is display-only and
  // never trusted for the write.
  const read = await readUpload(formData)
  if (!read.ok) return { status: "error", message: read.message }

  let result
  try {
    result = await commitTrackerImport(prisma, read.cards, { userId: session.user.id })
  } catch (error) {
    console.error("confirmTrackerImport failed:", error)
    return { status: "error", message: "The import could not be completed — nothing was changed." }
  }

  await emitDomainEvent({
    type: "TrackerImported",
    userId: session.user.id,
    householdId: result.householdId,
    householdName: result.householdName,
    created: result.created,
    updated: result.updated,
    removed: result.removed,
    cardCount: result.cards.length,
  })

  revalidatePath("/cards")
  revalidatePath("/overview")
  return {
    status: "done",
    householdName: result.householdName,
    created: result.created,
    updated: result.updated,
    cards: result.cards,
  }
}
