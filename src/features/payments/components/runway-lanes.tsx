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

import { addUtcDays, type RunwayEvent, type RunwayLane } from "@/lib/finance"
import { DUE_SOON_DAYS } from "@/features/cards/utils/card-status"
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
    return formatMonthDay(addUtcDays(asOf, day))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" data-testid="runway-board">
      <div className="grid grid-cols-[120px_1fr] border-b border-border bg-muted/40 lg:grid-cols-[180px_1fr]">
        <div className="px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Card / lane
        </div>
        <div className="grid grid-cols-6">
          {/* 10px below lg is a recorded micro-size exception (design QA DS-006):
              six date labels cannot hold 12px in a phone-width plot. */}
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <div
              key={i}
              className={`overflow-hidden whitespace-nowrap border-l border-dashed border-border px-1 py-2 text-[10px] font-medium uppercase tracking-[0.06em] tabular-nums lg:px-2 lg:text-xs lg:tracking-[0.14em] ${
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
        <p className="px-3 py-2.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
      className="grid grid-cols-[120px_1fr] border-b border-border last:border-b-0 lg:grid-cols-[180px_1fr]"
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

      <div
        className="relative h-16"
        data-lane-track
        role="group"
        aria-label={card?.cardName ?? "Card"}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-6" aria-hidden>
          {Array.from({ length: TICK_COUNT }, (_, i) => (
            <div key={i} className="border-l border-dashed border-border/50" />
          ))}
        </div>
        {lane.events.map((event, i) => (
          <EventChip
            key={`${event.kind}-${event.paymentId ?? i}`}
            event={event}
            cardName={card?.cardName ?? "Card"}
            autopayActive={card?.autopayActive ?? false}
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
  return { left: `${pct}%`, transform: `translateX(-${pct}%)` }
}

/**
 * Two sub-rows keep co-located chips legible (design QA): due chips ride
 * the bottom row; scheduled + close chips the top — a payment that covers
 * a due on the same date sits directly above it instead of on top of it.
 */
const ROW_TOP = "top-1.5"
const ROW_BOTTOM = "bottom-1.5"

function EventChip({
  event,
  cardName,
  autopayActive,
  mode,
  horizonDays,
  preview,
  onPreview,
  onCommit,
}: {
  event: RunwayEvent
  cardName: string
  /** EDR-016 provider autopay — renders the Hi-Fi "auto ✓" cue on due chips. */
  autopayActive: boolean
  mode: RunwayMode
  horizonDays: number
  preview: ReschedulePreview | null
  onPreview: (preview: ReschedulePreview | null) => void
  onCommit: (paymentId: string, toDay: number) => void
}) {
  const dragRef = useRef<{
    pointerId: number
    startX: number
    fromDay: number
    moved: boolean
  } | null>(null)

  // Contrast contract (design QA DS-001/002/005): chip TEXT is always
  // foreground/muted-foreground — hue rides the border + tint only, so
  // every rendered figure clears AA in both modes. De-emphasis for the
  // inactive toggle kind swaps to muted colors at full opacity, never an
  // opacity knockdown.
  const base =
    "absolute whitespace-nowrap rounded-full border px-2 py-1 font-mono text-xs tabular-nums transition-colors"

  if (event.kind === "close") {
    return (
      <span
        className={`${base} ${ROW_TOP} bg-muted/60 text-muted-foreground ${
          mode === "close" ? "border-secondary text-foreground" : "border-border"
        }`}
        style={chipPosition(event.daysFromToday, horizonDays)}
        title={`${cardName} — statement closes ${formatMonthDay(event.date)}`}
        data-testid="runway-event"
        data-kind="close"
        data-dimmed={mode === "due"}
      >
        Close<span className="hidden lg:inline"> {formatMonthDay(event.date)}</span>
      </span>
    )
  }

  if (event.kind === "due") {
    // Single-sourced urgency: the status engine's DUE_SOON rule (EDR-003);
    // confirmed provider autopay counts as coverage (issue #46, EDR-016).
    const autoCovered = autopayActive && !event.covered
    const uncoveredSoon = !event.covered && !autopayActive && event.daysFromToday <= DUE_SOON_DAYS
    const amount =
      event.covered && (event.shortfallMinor === 0n || event.amountMinor == null)
        ? "covered"
        : event.shortfallMinor != null && event.amountMinor != null && event.shortfallMinor < event.amountMinor
          ? `${formatMinor(event.shortfallMinor)} left`
          : event.amountMinor != null
            ? `${formatMinor(event.amountMinor)} min`
            : "min not set"
    const dimmed = mode === "close"
    return (
      <span
        className={`${base} ${ROW_BOTTOM} ${
          dimmed
            ? "border-border bg-card text-muted-foreground"
            : event.covered || autoCovered
              ? "border-success/50 bg-success/10 text-foreground"
              : uncoveredSoon
                ? "border-warning bg-warning/10 text-foreground"
                : "border-border bg-card text-foreground"
        }`}
        style={chipPosition(event.daysFromToday, horizonDays)}
        title={`${cardName} — payment due ${formatMonthDay(event.date)} · ${amount}`}
        data-testid="runway-event"
        data-kind="due"
        data-dimmed={dimmed}
      >
        {event.covered && "✓ "}Due {formatMonthDay(event.date)}
        <span className="hidden lg:inline"> · {amount}</span>
        {/* Chip contract: text stays foreground — the success border+tint carry the hue (design QA DS-007). */}
        {autoCovered && <span> · auto ✓</span>}
      </span>
    )
  }

  // Scheduled payment — the movable chip (drag or arrow keys).
  const paymentId = event.paymentId!
  const active = preview?.paymentId === paymentId
  const day = active ? preview.toDay : event.daysFromToday
  const clampDay = (d: number) => Math.min(horizonDays - 1, Math.max(0, d))
  // While a move is pending the chip tracks the TARGET date, not the stored one.
  const shownDate = addUtcDays(event.date, day - event.daysFromToday)

  const startPreview = (toDay: number) =>
    onPreview({
      paymentId,
      cardId: event.cardId,
      fromDay: event.daysFromToday,
      fromDate: event.date,
      toDay: clampDay(toDay),
    })

  // Drag is RELATIVE: the chip moves by the pointer's day-delta from the
  // grab point, never jumps to the absolute pointer position, and a small
  // pixel threshold keeps a jittery tap from becoming a move — a tap must
  // never silently reschedule a payment (review findings). pointercancel
  // (system gesture, incoming call) abandons the gesture and its preview.
  const DRAG_THRESHOLD_PX = 8
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, fromDay: day, moved: false }
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    const track = e.currentTarget.closest("[data-lane-track]")
    if (!track) return
    const dayWidth = track.getBoundingClientRect().width / (horizonDays - 1)
    const toDay = clampDay(drag.fromDay + Math.round(dx / dayWidth))
    if (toDay !== (active ? preview.toDay : event.daysFromToday)) startPreview(toDay)
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId !== e.pointerId) return
    dragRef.current = null
    // A gesture that actually dragged commits. A plain click/tap SELECTS
    // the chip instead — the Reschedule panel then offers button nudges +
    // Confirm, the non-drag single-pointer path SC 2.5.7 requires
    // (design QA DS-003). Selection alone never mutates anything.
    if (!drag.moved) {
      if (!active) startPreview(day)
      return
    }
    if (active && preview.toDay !== event.daysFromToday) onCommit(paymentId, preview.toDay)
    else onPreview(null)
  }
  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (drag?.pointerId !== e.pointerId) return
    dragRef.current = null
    if (drag.moved) onPreview(null)
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
      className={`${base} ${ROW_TOP} cursor-grab touch-none select-none focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing ${
        mode === "close" && !active
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-primary/50 bg-primary/10 text-primary"
      } ${active ? "z-10 ring-1 ring-ring" : ""}`}
      style={chipPosition(day, horizonDays)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      aria-label={`${cardName} — scheduled payment ${formatMinor(event.amountMinor ?? 0n)} on ${formatMonthDay(shownDate)}${
        active ? " (selected — arrows or panel buttons move it, Enter confirms, Escape cancels)" : ""
      } — drag, tap to select, or use arrow keys to reschedule`}
      data-testid="runway-event"
      data-kind="scheduled"
      data-dimmed={mode === "close"}
      data-payment-id={paymentId}
    >
      Pay<span className="hidden lg:inline"> {formatMinor(event.amountMinor ?? 0n)} ·</span>{" "}
      {formatMonthDay(shownDate)}
    </button>
  )
}
