"use client"

/**
 * One card-rack tile (issue #12, 0b wireframe) — the mockup tile idiom in the
 * app's own tokens: name + masked last-four, outlined StatusBadge, hero
 * balance, a utilization mini-bar, and a footer with the shared FreezeControl
 * and a disabled "Pay · Soon" affordance (no payments model exists yet). Client
 * because it hosts FreezeControl; the badge derives through the one status
 * engine (resolveStatusBadge) — never re-derived.
 */
import { Card } from "@/components/ui/card"
import { FreezeControl } from "@/features/cards/components/freeze-control"
import { StatusBadge } from "@/features/cards/components/status-badge"
import { resolveStatusBadge, type Alert, type Lifecycle } from "@/features/cards/utils/card-status"
import { HIGH_UTILIZATION_THRESHOLD } from "@/lib/finance"
import { formatMinor } from "@/lib/formatting"

export interface RackCardDto {
  cardId: string
  cardName: string
  lastFour: string | null
  lifecycle: Lifecycle
  alert: Alert
  balanceCents: number
  utilization: number | null
  /** Preformatted next-due label (e.g. "Jul 22 '26") or null when no due day. */
  dueLabel: string | null
  dueInDays: number | null
  minPayCents: number | null
  hasEstimatedInputs: boolean
}

export function CardRackTile({ card }: { card: RackCardDto }) {
  const high = card.utilization != null && card.utilization >= HIGH_UTILIZATION_THRESHOLD

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="rack-tile">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-tight">{card.cardName}</p>
          {card.lastFour && (
            <p className="text-xs text-muted-foreground tabular-nums">····{card.lastFour}</p>
          )}
        </div>
        <span className="shrink-0">
          <StatusBadge status={resolveStatusBadge(card.lifecycle, card.alert)} compact />
        </span>
      </div>

      <div className="text-2xl font-bold tabular-nums">{formatMinor(card.balanceCents)}</div>

      <span className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={`block h-full rounded-full ${high ? "bg-destructive" : "bg-success"}`}
          style={{
            width: `${card.utilization == null ? 0 : Math.min(100, card.utilization * 100)}%`,
          }}
        />
      </span>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {card.dueLabel ? `Due ${card.dueLabel}` : "—"}
        </span>
        <span className="flex items-center gap-1">
          <FreezeControl
            cardId={card.cardId}
            cardName={card.cardName}
            lastFour={card.lastFour}
            lifecycle={card.lifecycle}
            dueInDays={card.dueInDays}
            minPayCents={card.minPayCents}
            hasEstimatedInputs={card.hasEstimatedInputs}
          />
          <span
            className="inline-flex cursor-default items-center gap-1 px-2 text-xs font-medium text-muted-foreground/50"
            aria-disabled
            title="Payments arrive in a later phase"
          >
            Pay
            <span className="rounded border border-border px-1 py-px text-[9px] tracking-wide text-muted-foreground/70">
              Soon
            </span>
          </span>
        </span>
      </div>
    </Card>
  )
}
