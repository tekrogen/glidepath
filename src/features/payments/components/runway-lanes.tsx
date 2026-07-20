"use client"

/**
 * Runway lane calendar (issue #44, wireframe 1c / Hi-Fi runway): cards
 * are lanes, the 45-day window is the plot. Due and close occurrences
 * are fixed card facts; SCHEDULED payment chips are the movable objects
 * — drag (pointer events, so touch works) or focus + arrow keys, Enter
 * commits, Escape cancels. The by-due/by-close toggle is presentation
 * emphasis only: both kinds always render, the inactive kind dims
 * (engine contract — both are always emitted).
 */
import { useRef } from "react"

import type { RunwayEvent, RunwayLane } from "@/lib/finance"
import { formatMinor, formatMonthDay, formatPercent } from "@/lib/formatting"

import type { LaneCard, RunwayMode } from "./runway-view"
import type { ReschedulePreview } from "./reschedule-panel"

const TICK_COUNT = 6

interface RunwayLanesProps {
  lanes: RunwayLane[]
  cardsById: Map<string, LaneCard>
  mode: RunwayMode
  asOf: Date
  horizonDays: number
  preview: ReschedulePreview | null
  onPreview: (preview: ReschedulePreview | null) => void
  onCommit: (paymentId: string, toDay: number) => void
}

export function RunwayLanes({
  lanes,
  cardsById,
  mode,
  asOf,
  horizonDays,
  preview,
  onPreview,
  onCommit,
}: RunwayLanesProps) {
  const withEvents = lanes.filter((l) => l.events.length > 0)
  const quiet = lanes.length - withEvents.length

  const tickLabel = (index: number) => {
    if (index === 0) return "Today"
    const day = Math.round((index * horizonDays) / TICK_COUNT)
    return formatMonthDay(
      new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate() + day))
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" data-testid="runway-board">
      <div className="grid grid-cols-[120px_1fr] border-b border-border bg-muted/40 md:grid-cols-[180px_1fr]">
        <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Card / lane
        </div>
        <div className="grid grid-cols-6">
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <div
              key={i}
              className={`border-l border-dashed border-border px-2 py-2 text-[11px] font-medium uppercase tracking-[0.14em] tabular-nums ${
                i === 0 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {tickLabel(i)}
            </div>
          ))}
        </div>
      </div>

      {withEvents.map((lane) => (
        <Lane
          key={lane.cardId}
          lane={lane}
          card={cardsById.get(lane.cardId)}
          mode={mode}
          horizonDays={horizonDays}
          preview={preview}
          onPreview={onPreview}
          onCommit={onCommit}
        />
      ))}

      {withEvents.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No due dates, statement closes, or scheduled payments in the next {horizonDays} days.
        </p>
      )}
      {quiet > 0 && (
        <p className="px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
          + {quiet} {quiet === 1 ? "card" : "cards"} with no activity in this window
        </p>
      )}
    </div>
  )
}

function Lane({
  lane,
  card,
  mode,
  horizonDays,
  preview,
  onPreview,
  onCommit,
}: {
  lane: RunwayLane
  card: LaneCard | undefined
  mode: RunwayMode
  horizonDays: number
  preview: ReschedulePreview | null
  onPreview: (preview: ReschedulePreview | null) => void
  onCommit: (paymentId: string, toDay: number) => void
}) {
  const frozen = card?.lifecycle === "FROZEN"
  return (
    <div
      className="grid grid-cols-[120px_1fr] border-b border-border last:border-b-0 md:grid-cols-[180px_1fr]"
      data-testid="runway-lane"
    >
      <div className={`min-w-0 px-3 py-2.5 ${frozen ? "opacity-60" : ""}`}>
        <p className="truncate text-sm font-medium">
          {card?.cardName ?? "Card"}
          {frozen && (
            <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Frozen
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatMinor(lane.balanceMinor)} · {formatPercent(lane.utilization)}
        </p>
      </div>

      <div className="relative h-14" data-lane-track>
        <div className="pointer-events-none absolute inset-0 grid grid-cols-6" aria-hidden>
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <div key={i} className="border-l border-dashed border-border/50" />
          ))}
        </div>
        {lane.events.map((event, i) => (
          <EventChip
            key={`${event.kind}-${event.paymentId ?? i}`}
            event={event}
            mode={mode}
            horizonDays={horizonDays}
            preview={preview}
            onPreview={onPreview}
            onCommit={onCommit}
          />
        ))}
      </div>
    </div>
  )
}

/** Continuous slide: left/translateX by the same fraction keeps the chip inside the track at both ends. */
const chipPosition = (day: number, horizonDays: number) => {
  const pct = (day / Math.max(1, horizonDays - 1)) * 100
  return { left: `${pct}%`, transform: `translateX(-${pct}%) translateY(-50%)` }
}

function EventChip({
  event,
  mode,
  horizonDays,
  preview,
  onPreview,
  onCommit,
}: {
  event: RunwayEvent
  mode: RunwayMode
  horizonDays: number
  preview: ReschedulePreview | null
  onPreview: (preview: ReschedulePreview | null) => void
  onCommit: (paymentId: string, toDay: number) => void
}) {
  const dragRef = useRef<{ pointerId: number } | null>(null)

  const base =
    "absolute top-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums transition-opacity"

  if (event.kind === "close") {
    return (
      <span
        className={`${base} border-border bg-muted/60 text-muted-foreground ${
          mode === "close" ? "border-secondary text-secondary" : "opacity-40"
        }`}
        style={chipPosition(event.daysFromToday, horizonDays)}
        title={`Statement closes ${formatMonthDay(event.date)}`}
        data-testid="runway-event"
        data-kind="close"
        data-dimmed={mode === "due"}
      >
        Close {formatMonthDay(event.date)}
      </span>
    )
  }

  if (event.kind === "due") {
    const uncoveredSoon = !event.covered && event.daysFromToday <= 7
    const amount =
      event.covered && (event.shortfallMinor === 0n || event.amountMinor == null)
        ? "✓ covered"
        : event.shortfallMinor != null && event.amountMinor != null && event.shortfallMinor < event.amountMinor
          ? `${formatMinor(event.shortfallMinor)} left`
          : event.amountMinor != null
            ? `${formatMinor(event.amountMinor)} min`
            : "min not set"
    return (
      <span
        className={`${base} ${
          event.covered
            ? "border-success/50 bg-success/10 text-success"
            : uncoveredSoon
              ? "border-warning/60 bg-warning/10 text-warning"
              : "border-border bg-card text-foreground"
        } ${mode === "close" ? "opacity-40" : ""}`}
        style={chipPosition(event.daysFromToday, horizonDays)}
        title={`Payment due ${formatMonthDay(event.date)}`}
        data-testid="runway-event"
        data-kind="due"
        data-dimmed={mode === "close"}
      >
        Due {formatMonthDay(event.date)} · {amount}
      </span>
    )
  }

  // Scheduled payment — the movable chip (drag or arrow keys).
  const paymentId = event.paymentId!
  const active = preview?.paymentId === paymentId
  const day = active ? preview.toDay : event.daysFromToday
  const clampDay = (d: number) => Math.min(horizonDays - 1, Math.max(0, d))
  // While a move is pending the chip tracks the TARGET date, not the stored one.
  const shownDate = new Date(
    Date.UTC(
      event.date.getUTCFullYear(),
      event.date.getUTCMonth(),
      event.date.getUTCDate() + (day - event.daysFromToday)
    )
  )

  const startPreview = (toDay: number) =>
    onPreview({
      paymentId,
      cardId: event.cardId,
      fromDay: event.daysFromToday,
      fromDate: event.date,
      toDay: clampDay(toDay),
    })

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId }
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    const track = e.currentTarget.closest("[data-lane-track]")
    if (!track) return
    const rect = track.getBoundingClientRect()
    const toDay = clampDay(Math.round(((e.clientX - rect.left) / rect.width) * (horizonDays - 1)))
    if (toDay !== (active ? preview.toDay : event.daysFromToday)) startPreview(toDay)
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    if (active && preview.toDay !== event.daysFromToday) onCommit(paymentId, preview.toDay)
    else onPreview(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 7 : 1
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault()
      startPreview(day + (e.key === "ArrowRight" ? step : -step))
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (active && preview.toDay !== event.daysFromToday) onCommit(paymentId, preview.toDay)
    } else if (e.key === "Escape") {
      e.preventDefault()
      onPreview(null)
    }
  }

  return (
    <button
      type="button"
      className={`${base} cursor-grab touch-none select-none border-primary/50 bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing ${
        mode === "close" ? "opacity-40 focus-visible:opacity-100" : ""
      } ${active ? "z-10 opacity-100 ring-1 ring-ring" : ""}`}
      style={chipPosition(day, horizonDays)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onBlur={() => active && onPreview(null)}
      aria-label={`Scheduled payment ${formatMinor(event.amountMinor ?? 0n)} on ${formatMonthDay(event.date)} — drag or use arrow keys to reschedule`}
      data-testid="runway-event"
      data-kind="scheduled"
      data-dimmed={mode === "close"}
      data-payment-id={paymentId}
    >
      Pay {formatMinor(event.amountMinor ?? 0n)} · {formatMonthDay(shownDate)}
    </button>
  )
}
