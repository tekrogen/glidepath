/**
 * Card rack (issue #12, 0b wireframe) — "Card rack — freeze & pay inline".
 * Server component: serializes the portfolio cards into a client DTO (bigint →
 * number cents) at the RSC boundary, orders attention-worthy cards first, caps
 * at six tiles, and links out to /cards for the rest. Ordering is a simple sort
 * over fields already on the card (alert, balance) — no new math.
 */
import Link from "next/link"

import { nextDueDate } from "@/features/cards/utils/due-dates"
import type { PortfolioCard } from "@/features/cards/server/service"
import { formatShortDate } from "@/lib/formatting"

import { CardRackTile, type RackCardDto } from "./card-rack-tile"

const RACK_LIMIT = 6

export function CardRack({ cards, asOf }: { cards: PortfolioCard[]; asOf: Date }) {
  const eligible = cards.filter((c) => c.lifecycle !== "ARCHIVED")
  const ordered = [...eligible].sort(
    (a, b) =>
      (a.alert === "OK" ? 1 : 0) - (b.alert === "OK" ? 1 : 0) ||
      Number(b.finance.balanceMinor) - Number(a.finance.balanceMinor)
  )
  const shown = ordered.slice(0, RACK_LIMIT)
  if (shown.length === 0) return null
  const remaining = eligible.length - shown.length

  const dtos: RackCardDto[] = shown.map((c) => {
    const due = nextDueDate(c.paymentDueDay, asOf)
    return {
      cardId: c.id,
      cardName: c.cardName,
      lastFour: c.lastFour,
      lifecycle: c.lifecycle,
      alert: c.alert,
      balanceCents: Number(c.finance.balanceMinor),
      utilization: c.utilization,
      dueLabel: due ? formatShortDate(due) : null,
      dueInDays: c.dueInDays,
      minPayCents:
        c.finance.minimumPaymentMinor == null ? null : Number(c.finance.minimumPaymentMinor),
      hasEstimatedInputs: c.hasEstimatedInputs,
    }
  })

  return (
    <section className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Card rack — freeze &amp; pay inline
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dtos.map((c) => (
          <CardRackTile key={c.cardId} card={c} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="flex justify-center pt-1">
          <Link
            href="/cards"
            className="text-xs font-medium uppercase tracking-[0.14em] text-primary hover:underline"
          >
            {remaining} more {remaining === 1 ? "card" : "cards"} · View all {eligible.length} cards →
          </Link>
        </div>
      )}
    </section>
  )
}
