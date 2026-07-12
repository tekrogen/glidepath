/**
 * Cards — Hi-Fi normative (wireframe 2d function): the sortable, paged
 * portfolio table. Serializes portfolio rows into a plain DTO at the
 * RSC → client boundary (bigint never crosses it).
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { daysUntil, utilization } from "@/lib/finance"
import { formatAprBps, formatStampDate } from "@/lib/formatting"
import { getPortfolioForUser } from "@/features/cards"
import { CardsTable, type CardsTableRow } from "@/features/cards/components/cards-table"

export const dynamic = "force-dynamic"

export default async function CardsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cards")
  }

  const { cards } = await getPortfolioForUser(session.user.id)
  const today = new Date()

  const rows: CardsTableRow[] = cards.map((c) => {
    const f = c.finance
    const promoActive = f.promo != null && daysUntil(f.promo.endsOn, today) >= 0
    return {
      id: c.id,
      cardName: c.cardName,
      lastFour: c.lastFour,
      issuerKey: c.issuerKey,
      issuer: c.issuer,
      ownerLabel: c.ownerLabel,
      lifecycle: c.lifecycle,
      alert: c.alert,
      dueInDays: c.dueInDays,
      utilization: utilization(f.balanceMinor, f.limitMinor),
      balanceCents: Number(f.balanceMinor),
      limitCents: f.limitMinor == null ? null : Number(f.limitMinor),
      availableCents: f.limitMinor == null ? null : Number(f.limitMinor - f.balanceMinor),
      aprDisplay: promoActive
        ? `0% · ${daysUntil(f.promo!.endsOn, today)}d`
        : formatAprBps(f.regularAprBps),
      aprIsPromo: promoActive,
      dueDay: c.paymentDueDay,
      minPayCents: f.minimumPaymentMinor == null ? null : Number(f.minimumPaymentMinor),
      hasEstimatedInputs: c.hasEstimatedInputs,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Sortable · {rows.length} active
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Cards</h1>
        </div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {formatStampDate(new Date())} · Manual
        </p>
      </div>
      <CardsTable rows={rows} />
    </div>
  )
}
