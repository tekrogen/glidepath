/**
 * Overview — layout per the mockup (tiles → paydown + promo panels),
 * styling per the Ebia idiom. A pure composition layer (EMP#2067 §28):
 * every figure is precomputed by lib/finance via the cards service.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { formatStampDate } from "@/lib/formatting"
import { getPortfolioForUser } from "@/features/cards"
import { PortfolioMetricGrid } from "@/features/overview/components/portfolio-metric-grid"
import { PaydownPriorityPanel } from "@/features/paydown/components/paydown-priority-panel"
import { PromoPayoffPanel } from "@/features/paydown/components/promo-payoff-panel"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/overview")
  }

  const { cards, summary, promoPlans } = await getPortfolioForUser(session.user.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {summary.cardCount} cards · one ledger
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Overview</h1>
        </div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {formatStampDate(new Date())} · Manual
        </p>
      </div>

      <PortfolioMetricGrid summary={summary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <PaydownPriorityPanel cards={cards} />
        <PromoPayoffPanel plans={promoPlans} cards={cards} />
      </div>
    </div>
  )
}
