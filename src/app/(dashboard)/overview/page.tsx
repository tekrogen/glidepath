/**
 * Overview — layout per the mockup (tiles → paydown + promo panels),
 * styling per the Ebia idiom. A pure composition layer (EMP#2067 §28):
 * every figure is precomputed by lib/finance via the cards service.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          {summary.cardCount} cards · one ledger — balances, utilization, and 0% promo deadlines
          at a glance
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
