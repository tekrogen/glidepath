"use client"

/**
 * Reschedule preview panel (issue #44, wireframe 1c bottom triad —
 * "Drag a due date to reschedule / interest impact previews inline").
 * Idle it teaches the interaction; during a drag or keyboard move it is
 * the live readout, announced via aria-live. The ~interest delta is
 * rescheduleInterestDeltaMinor, rendered with EstimatedValue (EDR-020).
 */
import { MoveHorizontal } from "lucide-react"

import { EstimatedValue } from "@/components/ui/estimated-value"
import { addUtcDays, type Minor } from "@/lib/finance"
import { formatMinor, formatMonthDay } from "@/lib/formatting"

import type { LaneCard } from "./runway-view"

export interface ReschedulePreview {
  paymentId: string
  cardId: string
  fromDay: number
  toDay: number
  /** The payment's current (stored) date. */
  fromDate: Date
}

const RESCHEDULE_ESTIMATE_REASON =
  "Estimated — simple interest prorated per day (balance × APR ÷ 12 ÷ 30.4375), not the issuer's exact method."

export function ReschedulePanel({
  preview,
  cardsById,
  asOf,
  interestDeltaMinor,
  onNudge,
  onConfirm,
  onCancel,
}: {
  preview: ReschedulePreview | null
  cardsById: Map<string, LaneCard>
  asOf: Date
  interestDeltaMinor: Minor | null
  /** Move the selected payment's pending date by ±days (panel buttons — the non-drag pointer path, SC 2.5.7). */
  onNudge: (deltaDays: number) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const card = preview ? cardsById.get(preview.cardId) : null
  const toDate = preview ? addUtcDays(asOf, preview.toDay) : null
  const deltaDays = preview ? preview.toDay - preview.fromDay : 0

  return (
    <div
      className="rounded-xl border border-dashed border-border p-4"
      aria-live="polite"
      data-testid="reschedule-panel"
    >
      <div className="flex items-center gap-2">
        <MoveHorizontal className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold leading-none tracking-tight">Reschedule</h2>
      </div>

      {preview == null || toDate == null ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Drag a payment chip along its lane, tap it to select, or focus it and use the arrow
          keys (Shift for a week). Enter confirms, Escape cancels. The interest impact previews
          here.
        </p>
      ) : (
        <div className="mt-3 space-y-2 text-sm" data-testid="reschedule-preview">
          <p className="font-medium">{card?.cardName ?? "Payment"}</p>
          <p className="tabular-nums">
            {formatMonthDay(preview.fromDate)} → {formatMonthDay(toDate)}{" "}
            <span className="text-muted-foreground">
              ({deltaDays > 0 ? "+" : ""}
              {deltaDays} {Math.abs(deltaDays) === 1 ? "day" : "days"})
            </span>
          </p>
          <p className="tabular-nums">
            {interestDeltaMinor == null ? (
              <span className="text-muted-foreground">APR unknown — no interest estimate.</span>
            ) : deltaDays === 0 ? (
              <span className="text-muted-foreground">No change.</span>
            ) : interestDeltaMinor === 0n ? (
              <span className="text-muted-foreground">
                No interest impact — a promo shelters this balance.
              </span>
            ) : (
              <>
                <EstimatedValue reason={RESCHEDULE_ESTIMATE_REASON}>
                  {interestDeltaMinor > 0n ? "+" : "−"}
                  {formatMinor(interestDeltaMinor < 0n ? -interestDeltaMinor : interestDeltaMinor)}
                </EstimatedValue>{" "}
                <span className="text-muted-foreground">
                  {interestDeltaMinor > 0n ? "more" : "less"} interest
                </span>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <NudgeButton label="−7" onClick={() => onNudge(-7)} aria="A week earlier" />
            <NudgeButton label="−1" onClick={() => onNudge(-1)} aria="A day earlier" />
            <NudgeButton label="+1" onClick={() => onNudge(1)} aria="A day later" />
            <NudgeButton label="+7" onClick={() => onNudge(7)} aria="A week later" />
            <button
              type="button"
              onClick={onConfirm}
              data-testid="reschedule-confirm"
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              data-testid="reschedule-cancel"
              className="h-8 rounded-md border border-border px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Enter confirms · Escape cancels</p>
        </div>
      )}
    </div>
  )
}

function NudgeButton({
  label,
  aria,
  onClick,
}: {
  label: string
  aria: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className="h-8 w-9 rounded-md border border-border font-mono text-xs tabular-nums text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {label}
    </button>
  )
}
