"use client"

/**
 * Payment Runway view (issue #44, wireframe 1c: "the calendar IS the
 * interface"). Client root: reconstructs bigints from the DTO and runs
 * lib/finance itself (the what-if precedent — math stays in the finance
 * lib, EDR-019). Header + by-due/by-close toggle, lane calendar, then
 * the wireframe's bottom triad: cash-needed chart · payoff plan ·
 * reschedule preview. Reschedules apply optimistically and revert with
 * a toast on failure (the freeze-control idiom).
 */
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  addUtcDays,
  daysUntil,
  isPromoActive,
  rescheduleInterestDeltaMinor,
  runwayAggregate,
  type Minor,
  type RunwayCard,
  type RunwayPayment,
} from "@/lib/finance"
import { formatMinor, formatMonthDay } from "@/lib/formatting"
import { reschedulePayment } from "@/features/payments/actions/reschedule-payment"
import type { RunwayViewProps } from "@/features/payments/utils/serialize"

import { CashNeededChart } from "./cash-needed-chart"
import { PayoffPlanPanel } from "./payoff-plan-panel"
import { ReschedulePanel, type ReschedulePreview } from "./reschedule-panel"
import { RunwayLanes } from "./runway-lanes"

export type RunwayMode = "due" | "close"

/** Engine card + what the lane label renders. */
export interface LaneCard extends RunwayCard {
  cardName: string
  lifecycle: "ACTIVE" | "FROZEN" | "ARCHIVED"
}

const utcDay = (iso: string) => new Date(`${iso}T00:00:00Z`)
const addDaysIso = (base: Date, days: number) => addUtcDays(base, days).toISOString().slice(0, 10)

export function RunwayView({ cards, payments, asOf }: RunwayViewProps) {
  const asOfDate = useMemo(() => utcDay(asOf), [asOf])

  const laneCards: LaneCard[] = useMemo(
    () =>
      cards.map((c) => ({
        id: c.id,
        cardName: c.cardName,
        lifecycle: c.lifecycle,
        balanceMinor: BigInt(c.balanceCents),
        limitMinor: c.limitCents == null ? null : BigInt(c.limitCents),
        regularAprBps: c.regularAprBps,
        minimumPaymentMinor:
          c.minimumPaymentCents == null ? null : BigInt(c.minimumPaymentCents),
        promo: c.promo
          ? {
              endsOn: utcDay(c.promo.endsOn),
              shelteredBalanceMinor: BigInt(c.promo.shelteredBalanceCents),
              regularAprBpsAfter: c.promo.regularAprBpsAfter,
            }
          : null,
        paymentDueDay: c.paymentDueDay,
        statementCloseDay: c.statementCloseDay,
      })),
    [cards]
  )
  const cardsById = useMemo(
    () => new Map(laneCards.map((c) => [c.id, c])),
    [laneCards]
  )

  const [mode, setMode] = useState<RunwayMode>("due")
  /** Committed optimistic moves: payment id → ISO date. */
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<ReschedulePreview | null>(null)

  const enginePayments: RunwayPayment[] = useMemo(
    () =>
      payments.map((p) => ({
        id: p.id,
        cardId: p.cardId,
        amountMinor: BigInt(p.amountCents),
        scheduledFor: utcDay(overrides[p.id] ?? p.scheduledFor),
        status: "SCHEDULED" as const,
      })),
    [payments, overrides]
  )

  const aggregate = useMemo(
    () => runwayAggregate(laneCards, enginePayments, asOfDate),
    [laneCards, enginePayments, asOfDate]
  )

  // The engine preserves input order; the page owns sorting. Lanes with
  // events sort by soonest event, ties and event-less lanes by name.
  const sortedLanes = useMemo(() => {
    const name = (id: string) => cardsById.get(id)?.cardName ?? ""
    return [...aggregate.lanes].sort((a, b) => {
      const firstA = a.events[0]?.daysFromToday ?? Number.POSITIVE_INFINITY
      const firstB = b.events[0]?.daysFromToday ?? Number.POSITIVE_INFINITY
      return firstA - firstB || name(a.cardId).localeCompare(name(b.cardId))
    })
  }, [aggregate.lanes, cardsById])

  /** ~Interest delta for the live preview (EDR-020: renders with "~"). */
  const previewInterestMinor: Minor | null = useMemo(() => {
    if (!preview) return null
    const card = cardsById.get(preview.cardId)
    if (!card) return null
    return rescheduleInterestDeltaMinor(
      card.balanceMinor,
      card.regularAprBps,
      isPromoActive(card, asOfDate, daysUntil),
      preview.toDay - preview.fromDay
    )
  }, [preview, cardsById, asOfDate])

  const commitReschedule = async (paymentId: string, toDay: number) => {
    const current = preview
    setPreview(null)
    const fromIso =
      overrides[paymentId] ??
      payments.find((p) => p.id === paymentId)?.scheduledFor
    const toIso = addDaysIso(asOfDate, toDay)
    if (!fromIso || fromIso === toIso) return

    const previousOverride = overrides[paymentId]
    setOverrides((o) => ({ ...o, [paymentId]: toIso }))

    const res = await reschedulePayment(paymentId, toIso)
    if (!res.success) {
      setOverrides((o) => {
        const next = { ...o }
        if (previousOverride == null) delete next[paymentId]
        else next[paymentId] = previousOverride
        return next
      })
      toast.error(res.message)
      return
    }
    const cardName = current ? cardsById.get(current.cardId)?.cardName : null
    toast.success(
      `${cardName ?? "Payment"} payment moved to ${formatMonthDay(utcDay(toIso))}.`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Next {aggregate.horizonDays} days
          </p>
          <h1 className="font-heading text-4xl font-bold tracking-tight tabular-nums">
            {formatMinor(aggregate.totalCashNeededMinor)}{" "}
            <span className="text-2xl font-semibold text-muted-foreground">
              needed before {formatMonthDay(aggregate.horizonEnd)}
            </span>
          </h1>
        </div>

        <div
          className="inline-flex rounded-md border border-border p-0.5"
          role="group"
          aria-label="Lane emphasis"
          data-testid="runway-toggle"
        >
          <ModeChip active={mode === "due"} onClick={() => setMode("due")}>
            By due date
          </ModeChip>
          <ModeChip active={mode === "close"} onClick={() => setMode("close")}>
            By statement close
          </ModeChip>
        </div>
      </div>

      <RunwayLanes
        lanes={sortedLanes}
        cardsById={cardsById}
        mode={mode}
        asOf={asOfDate}
        horizonDays={aggregate.horizonDays}
        preview={preview}
        onPreview={setPreview}
        onCommit={commitReschedule}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <CashNeededChart weeks={aggregate.weeks} totalMinor={aggregate.totalCashNeededMinor} />
        <PayoffPlanPanel cards={laneCards} asOf={asOfDate} />
        <ReschedulePanel
          preview={preview}
          cardsById={cardsById}
          asOf={asOfDate}
          interestDeltaMinor={previewInterestMinor}
          onNudge={(deltaDays) =>
            setPreview((p) =>
              p == null
                ? null
                : {
                    ...p,
                    toDay: Math.min(
                      aggregate.horizonDays - 1,
                      Math.max(0, p.toDay + deltaDays)
                    ),
                  }
            )
          }
          onConfirm={() => {
            if (preview && preview.toDay !== preview.fromDay) {
              void commitReschedule(preview.paymentId, preview.toDay)
            }
          }}
          onCancel={() => setPreview(null)}
        />
      </div>
    </div>
  )
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
