/**
 * Overview — the full v2 dashboard per the 0b wireframe: total-balance header →
 * metric grid → card rack (freeze inline) → attention feed → transactions +
 * upcoming payments + spend donut → paydown + promo panels. A pure composition
 * layer (EMP#2067 §28 / EDR-019): every figure is precomputed by lib/finance
 * via the cards service; builders produce the derived arrays; components receive
 * ready props. `asOf` is the single clock every builder reuses.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getPortfolioForUser } from "@/features/cards"
import { buildAttentionItems, buildUpcomingPayments } from "@/features/overview"
import { CardRack } from "@/features/overview/components/card-rack"
import { DashboardAttention } from "@/features/overview/components/dashboard-attention"
import { OverviewFirstRun } from "@/features/overview/components/overview-first-run"
import { OverviewHeader } from "@/features/overview/components/overview-header"
import { PortfolioMetricGrid } from "@/features/overview/components/portfolio-metric-grid"
import { SpendDonutWidget } from "@/features/overview/components/spend-donut-widget"
import { TransactionsWidget } from "@/features/overview/components/transactions-widget"
import { UpcomingPaymentsWidget } from "@/features/overview/components/upcoming-payments-widget"
import { PaydownPriorityPanel } from "@/features/paydown/components/paydown-priority-panel"
import { PromoPayoffPanel } from "@/features/paydown/components/promo-payoff-panel"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/overview")
  }

  const { cards, summary, promoPlans, asOf } = await getPortfolioForUser(session.user.id)

  // Zero-card first run: one designed welcome instead of a zeroed dashboard
  // (issue #29). A composition branch, not math (EDR-019).
  if (summary.cardCount === 0) {
    return <OverviewFirstRun />
  }

  const attentionItems = buildAttentionItems(cards, asOf)
  const upcomingPayments = buildUpcomingPayments(cards, asOf)

  return (
    <div className="space-y-8">
      <OverviewHeader summary={summary} />

      <PortfolioMetricGrid summary={summary} />

      <CardRack cards={cards} asOf={asOf} />

      <DashboardAttention items={attentionItems} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TransactionsWidget />
        </div>
        <div className="space-y-6">
          <UpcomingPaymentsWidget items={upcomingPayments} />
          <SpendDonutWidget />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PaydownPriorityPanel cards={cards} />
        <PromoPayoffPanel plans={promoPlans} cards={cards} />
      </div>
    </div>
  )
}
