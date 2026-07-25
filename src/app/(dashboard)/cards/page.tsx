/**
 * Cards — Hi-Fi normative (wireframe 2d function): the sortable, paged
 * portfolio table. Serializes portfolio rows into a plain DTO at the
 * RSC → client boundary (bigint never crosses it).
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { daysUntil, utilization } from "@/lib/finance"
import { formatAprBps, formatStampDate, toDollarInput, toPercentInput } from "@/lib/formatting"
import { getMembersForUser, getPortfolioForUser } from "@/features/cards"
import { CardsEmptyState } from "@/features/cards/components/cards-empty-state"
import { CardsTable, type CardsTableRow } from "@/features/cards/components/cards-table"

export const dynamic = "force-dynamic"

export default async function CardsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cards")
  }

  const [{ cards }, members] = await Promise.all([
    getPortfolioForUser(session.user.id),
    getMembersForUser(session.user.id),
  ])
  const today = new Date()

  const rows: CardsTableRow[] = cards.map((c) => {
    const f = c.finance
    const promoActive = f.promo != null && daysUntil(f.promo.endsOn, today) >= 0
    // The edit seed reflects the STORED promo row (even date-expired — an
    // expired promo is legal data, the status engine's business); the APR
    // input seeds from wherever the rate lives (card-level, or the promo's
    // after-rate while a promo shelters it).
    const seedAprBps = f.promo != null ? f.promo.regularAprBpsAfter : f.regularAprBps
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
      edit: {
        cardId: c.id,
        cardName: c.cardName,
        hasPromo: f.promo != null,
        values: {
          cardName: c.cardName,
          issuer: c.issuer,
          lastFour: c.lastFour ?? "",
          creditLimit: f.limitMinor == null ? "" : toDollarInput(f.limitMinor),
          currentBalance: toDollarInput(f.balanceMinor),
          regularApr: seedAprBps == null ? "" : toPercentInput(seedAprBps),
          promoEndsOn: f.promo == null ? "" : f.promo.endsOn.toISOString().slice(0, 10),
          paymentDueDay: c.paymentDueDay?.toString() ?? "",
          statementCloseDay: c.statementCloseDay?.toString() ?? "",
          minimumPayment:
            f.minimumPaymentMinor == null ? "" : toDollarInput(f.minimumPaymentMinor),
          paymentNote: c.paymentNote ?? "",
          notes: c.notes ?? "",
          ownerMemberId: c.ownerMemberId ?? "",
        },
        scheduledPaymentCount: c.scheduledPaymentCount,
        statementCount: c.statementCount,
        hasAutopayLink: c.hasAutopayLink,
      },
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {rows.length === 0 ? "Your portfolio" : `Sortable · ${rows.length} active`}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Cards</h1>
        </div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {formatStampDate(new Date())} · Manual
        </p>
      </div>
      {rows.length === 0 ? <CardsEmptyState /> : <CardsTable rows={rows} members={members} />}
    </div>
  )
}
