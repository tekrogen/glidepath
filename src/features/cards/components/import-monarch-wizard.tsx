"use client"

/**
 * Monarch balances import wizard (issue #48) — the #28 wizard machine
 * copied verbatim (derived step, remount-to-reset, manual FormData,
 * server-confirmed steps, no optimistic updates; confirm re-sends the
 * exact File bytes and the server recomputes everything). New here: the
 * match table — remembered/suggested rows proceed untouched, ambiguous
 * rows BLOCK confirm until picked or explicitly skipped (money never
 * rubber-stamps onto the wrong card), and every resolution is remembered
 * for next week's re-run.
 */
import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  confirmMonarchImport,
  previewMonarchImport,
  type ConfirmMonarchState,
  type MonarchPickerCard,
  type MonarchPreviewEntry,
  type PreviewMonarchState,
} from "@/features/cards/actions/import-monarch"
import { formatMinor, formatShortDate } from "@/lib/formatting"

// Mirrors the server action's cap — see the constant-pair comment there.
const MAX_UPLOAD_BYTES = 1024 * 1024

const utcDay = (iso: string) => new Date(`${iso}T00:00:00Z`)

export function ImportMonarchWizard() {
  const [generation, setGeneration] = useState(0)
  return <WizardRun key={generation} onRestart={() => setGeneration((g) => g + 1)} />
}

function WizardRun({ onRestart }: { onRestart: () => void }) {
  const router = useRouter()
  const [previewState, previewAction] = useActionState(previewMonarchImport, {
    status: "idle",
  } as PreviewMonarchState)
  const [confirmState, confirmAction] = useActionState(confirmMonarchImport, {
    status: "idle",
  } as ConfirmMonarchState)
  const [file, setFile] = useState<File | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  // accountKey → cardId (null = explicit skip). Only rows the user touched.
  const [resolutions, setResolutions] = useState<Record<string, string | null>>({})
  const [pending, startTransition] = useTransition()
  const errorRef = useRef<HTMLDivElement>(null)

  const step: "upload" | "preview" | "done" =
    confirmState.status === "done" ? "done" : previewState.status === "ready" ? "preview" : "upload"

  const dispatch = (action: (fd: FormData) => void, withResolutions: boolean) => {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setClientError("That file is too large — export a shorter date range from Monarch.")
      return
    }
    setClientError(null)
    const fd = new FormData()
    fd.set("file", file)
    if (withResolutions) {
      fd.set(
        "resolutions",
        JSON.stringify(
          Object.entries(resolutions).map(([accountKey, cardId]) => ({ accountKey, cardId }))
        )
      )
    }
    startTransition(() => action(fd))
  }

  const errorMessage =
    clientError ??
    (previewState.status === "error" ? previewState.message : null) ??
    (confirmState.status === "error" ? confirmState.message : null)

  useEffect(() => {
    if (errorMessage) errorRef.current?.focus()
  }, [errorMessage])

  useEffect(() => {
    if (confirmState.status === "done") {
      toast.success(
        `${confirmState.updated} card balance${confirmState.updated === 1 ? "" : "s"} updated as of ${formatShortDate(utcDay(confirmState.asOfDate))}.`
      )
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per confirm result only
  }, [confirmState])

  // Confirm is blocked while ANY ambiguous row lacks an explicit choice.
  const unresolvedAmbiguous =
    previewState.status === "ready"
      ? previewState.entries.filter((e) => e.status === "ambiguous" && !(e.accountKey in resolutions))
      : []

  return (
    <div className="space-y-6">
      <p role="status" className="sr-only">
        {pending
          ? step === "upload"
            ? "Reading balances…"
            : "Updating balances…"
          : previewState.status === "ready"
            ? `${previewState.entries.length} accounts found.`
            : confirmState.status === "done"
              ? "Import complete."
              : ""}
      </p>

      {errorMessage && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          data-testid="import-error"
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-error-text focus:outline-none focus:ring-2 focus:ring-destructive/40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {step === "upload" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium">Monarch balances export</p>
                <p id="monarch-file-hint" className="text-xs text-muted-foreground">
                  Monarch → Accounts → Download balances. Columns: Date, Balance, Account. Only the
                  newest balance per account is used; nothing changes until you confirm.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monarch-file">Balances CSV</Label>
              <Input
                id="monarch-file"
                type="file"
                accept=".csv,text/csv"
                aria-describedby="monarch-file-hint"
                onChange={(e) => {
                  setClientError(null)
                  setFile(e.target.files?.[0] ?? null)
                }}
              />
            </div>
            <Button
              onClick={() => dispatch(previewAction, false)}
              disabled={!file || pending}
              data-testid="monarch-preview"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Preview import
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "preview" && previewState.status === "ready" && (
        <PreviewStep
          state={previewState}
          resolutions={resolutions}
          onResolve={(accountKey, cardId) =>
            setResolutions((r) => ({ ...r, [accountKey]: cardId }))
          }
          unresolvedCount={unresolvedAmbiguous.length}
          pending={pending}
          onBack={onRestart}
          onConfirm={() => dispatch(confirmAction, true)}
        />
      )}

      {step === "done" && confirmState.status === "done" && (
        <ReportStep state={confirmState} onRestart={onRestart} onView={() => router.push("/cards")} />
      )}
    </div>
  )
}

const STATUS_LABEL: Record<MonarchPreviewEntry["status"], string> = {
  remembered: "Remembered",
  suggested: "Suggested",
  ambiguous: "Choose…",
  unmatched: "Skipped",
  nonCard: "Skipped",
}

function PreviewStep({
  state,
  resolutions,
  onResolve,
  unresolvedCount,
  pending,
  onBack,
  onConfirm,
}: {
  state: Extract<PreviewMonarchState, { status: "ready" }>
  resolutions: Record<string, string | null>
  onResolve: (accountKey: string, cardId: string | null) => void
  unresolvedCount: number
  pending: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const cardsById = new Map(state.pickerCards.map((c) => [c.id, c]))
  const cardRows = state.entries.filter((e) => e.status !== "nonCard")
  const skippedRows = state.entries.filter((e) => e.status === "nonCard")

  /** The effective target for an entry: user choice wins, else the plan's. */
  const targetOf = (e: MonarchPreviewEntry): string | null =>
    e.accountKey in resolutions ? resolutions[e.accountKey] : e.cardId

  // Cards already taken by another row — disabled in other pickers.
  const takenBy = new Map<string, string>()
  for (const e of state.entries) {
    const t = targetOf(e)
    if (t) takenBy.set(t, e.accountKey)
  }

  const importCount = state.entries.filter((e) => targetOf(e) != null).length

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {state.fileName} — balances as of {formatShortDate(utcDay(state.asOfDate))}
            </p>
            <p className="text-xs text-muted-foreground">
              {cardRows.length} card account{cardRows.length === 1 ? "" : "s"} found ·{" "}
              {skippedRows.length} other account{skippedRows.length === 1 ? "" : "s"} skipped
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} disabled={pending}>
            Choose a different file
          </Button>
        </div>

        {state.parseWarnings.length > 0 && (
          <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-foreground">
            {state.parseWarnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}

        <ul className="space-y-2">
          {cardRows.map((entry) => (
            <MatchRow
              key={entry.accountKey}
              entry={entry}
              cardsById={cardsById}
              pickerCards={state.pickerCards}
              target={targetOf(entry)}
              takenBy={takenBy}
              resolved={entry.accountKey in resolutions}
              onResolve={onResolve}
            />
          ))}
        </ul>

        {skippedRows.length > 0 && (
          <details className="rounded-md border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Other accounts skipped ({skippedRows.length}) — bank balances aren&apos;t imported
            </summary>
            <ul className="mt-2 space-y-2">
              {skippedRows.map((entry) => (
                <MatchRow
                  key={entry.accountKey}
                  entry={entry}
                  cardsById={cardsById}
                  pickerCards={state.pickerCards}
                  target={targetOf(entry)}
                  takenBy={takenBy}
                  resolved={entry.accountKey in resolutions}
                  onResolve={onResolve}
                />
              ))}
            </ul>
          </details>
        )}

        {state.cardsNotInFile.length > 0 && (
          <details className="rounded-md border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Not in this export ({state.cardsNotInFile.length})
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {state.cardsNotInFile.map((c) => (
                <li key={c.id}>
                  {c.cardName} · {c.issuer}
                  {c.lastFour ? ` · ····${c.lastFour}` : ""} — untouched
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Importing updates balances on linked cards only — it never creates or removes cards.
            Links are remembered for next time.
          </p>
          <div className="flex items-center gap-3">
            {unresolvedCount > 0 && (
              <p className="text-xs text-error-text" role="status">
                {unresolvedCount} account{unresolvedCount === 1 ? " needs" : "s need"} a choice
              </p>
            )}
            <Button
              onClick={onConfirm}
              disabled={pending || unresolvedCount > 0 || importCount === 0}
              data-testid="monarch-confirm"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update {importCount} card balance{importCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MatchRow({
  entry,
  cardsById,
  pickerCards,
  target,
  takenBy,
  resolved,
  onResolve,
}: {
  entry: MonarchPreviewEntry
  cardsById: Map<string, MonarchPickerCard>
  pickerCards: MonarchPickerCard[]
  target: string | null
  takenBy: Map<string, string>
  resolved: boolean
  onResolve: (accountKey: string, cardId: string | null) => void
}) {
  const targetCard = target ? cardsById.get(target) : null
  const ranked = entry.rankedCandidateIds
    .map((id) => cardsById.get(id))
    .filter((c): c is MonarchPickerCard => c != null)
  const rest = pickerCards.filter((c) => !entry.rankedCandidateIds.includes(c.id))
  const needsChoice = entry.status === "ambiguous" && !resolved

  return (
    <li
      className={`rounded-md border px-3 py-2 ${needsChoice ? "border-warning" : "border-border"}`}
      data-testid="monarch-row"
      data-status={entry.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{entry.accountKey}</p>
          <p className="text-xs text-muted-foreground">
            as of {formatShortDate(utcDay(entry.asOf))}
          </p>
        </div>
        <Badge variant={entry.status === "remembered" || entry.status === "suggested" ? "secondary" : "outline"}>
          {resolved && entry.status !== "remembered" && entry.status !== "suggested"
            ? target
              ? "Linked"
              : "Skipped"
            : STATUS_LABEL[entry.status]}
        </Badge>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <select
          value={target ?? ""}
          onChange={(e) => onResolve(entry.accountKey, e.target.value === "" ? null : e.target.value)}
          aria-label={`Card for ${entry.accountKey}`}
          data-testid="monarch-picker"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        >
          <option value="">Don&apos;t import</option>
          {[...ranked, ...rest].map((c) => {
            const heldBy = takenBy.get(c.id)
            const disabled = heldBy != null && heldBy !== entry.accountKey
            return (
              <option key={c.id} value={c.id} disabled={disabled}>
                {c.cardName} · {c.issuer}
                {c.lastFour ? ` · ····${c.lastFour}` : ""} · {formatMinor(c.balanceCents)}
                {disabled ? " — already linked" : ""}
              </option>
            )
          })}
        </select>
        <p className="text-sm tabular-nums" data-testid="monarch-delta">
          {targetCard ? (
            targetCard.balanceCents === entry.owedCents ? (
              <span className="text-muted-foreground">No change</span>
            ) : (
              <>
                {formatMinor(targetCard.balanceCents)} → {formatMinor(entry.owedCents)}
              </>
            )
          ) : (
            <span className="text-muted-foreground">not imported</span>
          )}
        </p>
      </div>

      {entry.warnings.length > 0 && (
        <ul className="mt-2 space-y-1">
          {entry.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function ReportStep({
  state,
  onRestart,
  onView,
}: {
  state: Extract<ConfirmMonarchState, { status: "done" }>
  onRestart: () => void
  onView: () => void
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          {/* Heading, matching the tracker report's idiom. */}
          <h2 className="font-heading text-xl font-semibold">Import complete</h2>
          <p className="text-xs text-muted-foreground">
            {state.updated} card{state.updated === 1 ? "" : "s"} updated ({state.changed} balance
            change{state.changed === 1 ? "" : "s"}, {state.mappingsSaved} link
            {state.mappingsSaved === 1 ? "" : "s"} saved) · as of{" "}
            {formatShortDate(utcDay(state.asOfDate))} · {state.skippedCount} account
            {state.skippedCount === 1 ? "" : "s"} skipped
            {state.unmatchedCount > 0 ? `, ${state.unmatchedCount} unmatched` : ""}
          </p>
        </div>
        <ul className="space-y-1" data-testid="monarch-report">
          {state.cards.map((c) => (
            <li key={c.cardId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {c.cardName} · {c.issuer}
                {c.lastFour ? ` · ····${c.lastFour}` : ""}
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {formatMinor(c.beforeCents)} → {formatMinor(c.afterCents)}
                <Badge variant={c.outcome === "changed" ? "default" : "secondary"}>
                  {c.outcome === "changed" ? "Changed" : "Unchanged"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onRestart}>
            Import another
          </Button>
          <Button onClick={onView}>View cards</Button>
        </div>
      </CardContent>
    </Card>
  )
}
