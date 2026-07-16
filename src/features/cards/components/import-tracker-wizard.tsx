"use client"

/**
 * Tracker-import wizard (issue #28, EDR-021 step 2): upload → preview →
 * confirm → report, over the preview/confirm server actions. Follows the
 * add-card idiom: useActionState, server-confirmed pending UI, no
 * optimistic update (monetary-mutation policy).
 *
 * The chosen File is held in state and both actions receive a manually
 * built FormData — React 19 resets uncontrolled inputs after an action
 * settles and a file input cannot be re-populated, yet confirm must
 * re-send the exact bytes the preview showed (the server re-parses them;
 * the client preview is never trusted for the write).
 */
import { startTransition, useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { formatAprBps, formatMinor, formatShortDate } from "@/lib/formatting"
import {
  confirmTrackerImport,
  previewTrackerImport,
  type ConfirmTrackerState,
  type PreviewTrackerState,
  type TrackerPreviewCard,
} from "@/features/cards/actions/import-tracker"

const previewInitial: PreviewTrackerState = { status: "idle" }
const confirmInitial: ConfirmTrackerState = { status: "idle" }

function aprDisplay(card: TrackerPreviewCard): string {
  if (card.promo) {
    const after = card.promo.regularAprBpsAfter
    const until = formatShortDate(new Date(card.promo.endsOn))
    return after == null ? `0% until ${until}` : `0% until ${until} · then ${formatAprBps(after)}`
  }
  return formatAprBps(card.regularAprBps)
}

export function ImportTrackerWizard() {
  // "Choose a different file" / "Import another" restart the wizard by
  // remounting it — useActionState has no reset, so a fresh mount is the
  // honest way to get fresh action state.
  const [generation, setGeneration] = useState(0)
  return <WizardRun key={generation} onRestart={() => setGeneration((g) => g + 1)} />
}

function WizardRun({ onRestart }: { onRestart: () => void }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewState, previewAction, previewPending] = useActionState(
    previewTrackerImport,
    previewInitial
  )
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmTrackerImport,
    confirmInitial
  )
  const errorRef = useRef<HTMLDivElement>(null)
  const pending = previewPending || confirmPending

  // The step is derived, never stored: the server's confirmed state is the
  // only source of truth (monetary flow — no optimistic transitions).
  const step: "upload" | "preview" | "done" =
    confirmState.status === "done" ? "done" : previewState.status === "ready" ? "preview" : "upload"

  function dispatch(action: (fd: FormData) => void) {
    if (!file) return
    const fd = new FormData()
    fd.append("file", file)
    startTransition(() => action(fd))
  }

  const errorMessage =
    (previewState.status === "error" && previewState.message) ||
    (confirmState.status === "error" && confirmState.message) ||
    null

  // Side effects on server-confirmed results: announce the import once,
  // and move focus to the error banner so failures are perceivable.
  useEffect(() => {
    if (confirmState.status === "done") {
      toast.success(
        `Imported ${confirmState.created + confirmState.updated} cards into ${confirmState.householdName}`
      )
      router.refresh()
    }
  }, [confirmState, router])

  useEffect(() => {
    if (errorMessage) errorRef.current?.focus()
  }, [errorMessage])

  return (
    <div className="space-y-6">
      <p role="status" className="sr-only">
        {previewPending ? "Reading tracker…" : confirmPending ? "Importing cards…" : ""}
      </p>

      {errorMessage && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {step === "upload" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
              aria-hidden
            >
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            </span>
            <h2 className="font-heading text-xl font-semibold">Upload your tracker</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Choose the tracker workbook (.xlsx). Every card is shown for review first —
              nothing is imported until you confirm.
            </p>
            <div className="w-full max-w-sm space-y-2 text-left">
              <Label htmlFor="tracker-file">Tracker workbook</Label>
              <input
                id="tracker-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-describedby="tracker-file-hint"
                className="w-full cursor-pointer rounded-md border border-border bg-background text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-l-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p id="tracker-file-hint" className="text-xs text-muted-foreground">
                Cards are read from the &ldquo;Card Tracker&rdquo; sheet, rows 6–25
              </p>
            </div>
            <Button type="button" disabled={!file || pending} onClick={() => dispatch(previewAction)}>
              {previewPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Preview import
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "preview" && previewState.status === "ready" && (
        <PreviewStep
          state={previewState}
          pending={pending}
          confirmPending={confirmPending}
          onBack={onRestart}
          onConfirm={() => dispatch(confirmAction)}
        />
      )}

      {step === "done" && confirmState.status === "done" && (
        <ReportStep
          state={confirmState}
          onViewCards={() => router.push("/cards")}
          onImportAnother={onRestart}
        />
      )}
    </div>
  )
}

function PreviewStep({
  state,
  pending,
  confirmPending,
  onBack,
  onConfirm,
}: {
  state: Extract<PreviewTrackerState, { status: "ready" }>
  pending: boolean
  confirmPending: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{state.fileName}</span> —{" "}
          {state.cards.length} cards found
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={pending}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Choose a different file
        </Button>
      </div>

      {state.totalWarnings > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {state.totalWarnings} field{state.totalWarnings === 1 ? "" : "s"} need attention.
            </span>{" "}
            Nothing is guessed silently — review the notes under each card, then confirm.
            Missing values can be filled in on the card after import.
          </p>
        </div>
      )}

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {["Card", "Issuer", "Last 4", "Balance", "Limit", "APR", "Due day", "Min pay"].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-xs font-medium tracking-wide uppercase text-muted-foreground"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {state.cards.map((card, i) => (
                <PreviewRow key={`${card.cardName}-${card.issuer}-${card.lastFour ?? i}`} card={card} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">
          Re-importing the same tracker updates existing cards — it never duplicates them.
        </p>
        <Button type="button" onClick={onConfirm} disabled={pending}>
          {confirmPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Import {state.cards.length} cards
        </Button>
      </div>
    </div>
  )
}

function PreviewRow({ card }: { card: TrackerPreviewCard }) {
  return (
    <>
      <tr className={card.warnings.length ? "[&>td]:pb-1" : undefined}>
        <td className="px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="font-medium">{card.cardName}</span>
            {card.ownerLabel && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {card.ownerLabel}
              </Badge>
            )}
          </span>
        </td>
        <td className="px-4 py-3">{card.issuer}</td>
        <td className="px-4 py-3 tabular-nums">
          {card.lastFour ? `•••• ${card.lastFour}` : "—"}
        </td>
        <td className="px-4 py-3 tabular-nums">{formatMinor(card.currentBalanceCents)}</td>
        <td className="px-4 py-3 tabular-nums">
          {card.creditLimitCents == null ? "—" : formatMinor(card.creditLimitCents)}
        </td>
        <td className="px-4 py-3">{aprDisplay(card)}</td>
        <td className="px-4 py-3 tabular-nums">{card.paymentDueDay ?? "—"}</td>
        <td className="px-4 py-3 tabular-nums">
          {card.minimumPaymentCents != null ? (
            formatMinor(card.minimumPaymentCents)
          ) : card.paymentNote ? (
            <span className="text-muted-foreground">&ldquo;{card.paymentNote}&rdquo;</span>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {card.warnings.length > 0 && (
        <tr className="border-0">
          <td colSpan={8} className="px-4 pb-3 pt-0">
            <ul className="space-y-0.5">
              {card.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

function ReportStep({
  state,
  onViewCards,
  onImportAnother,
}: {
  state: Extract<ConfirmTrackerState, { status: "done" }>
  onViewCards: () => void
  onImportAnother: () => void
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            aria-hidden
          >
            <CheckCircle2 className="h-6 w-6 text-primary" />
          </span>
          <h2 className="font-heading text-xl font-semibold">Import complete</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {state.created} created, {state.updated} updated in{" "}
            <span className="font-medium text-foreground">{state.householdName}</span>.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onImportAnother}>
              Import another
            </Button>
            <Button type="button" onClick={onViewCards}>
              View cards
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {["Card", "Issuer", "Last 4", "Outcome"].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-xs font-medium tracking-wide uppercase text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {state.cards.map((c, i) => (
                <tr key={`${c.cardName}-${c.issuer}-${c.lastFour ?? i}`}>
                  <td className="px-4 py-3 font-medium">{c.cardName}</td>
                  <td className="px-4 py-3">{c.issuer}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.lastFour ? `•••• ${c.lastFour}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.outcome === "created" ? "default" : "secondary"}>
                      {c.outcome}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
