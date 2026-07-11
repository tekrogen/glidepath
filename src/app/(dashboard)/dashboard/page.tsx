import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchDashboardData } from "./lib/fetch-dashboard-data";
import { CreditCardsWidget } from "@/components/dashboard/widgets/credit-cards-widget";
import { BudgetWidget } from "@/components/dashboard/widgets/budget-widget";
import { SpendingWidget } from "@/components/dashboard/widgets/spending-widget";
import { TransactionsWidget } from "@/components/dashboard/widgets/transactions-widget";
import { RecurringWidget } from "@/components/dashboard/widgets/recurring-widget";
import { AiInsightsWidget } from "@/components/dashboard/widgets/ai-insights-widget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  const data = await fetchDashboardData(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <CreditCardsWidget data={data.creditCards} />

        <SpendingWidget data={data.spending} />

        <BudgetWidget data={data.budgets} />

        <TransactionsWidget transactions={data.recentTransactions} />

        <RecurringWidget data={data.recurring} />

        <AiInsightsWidget items={data.insights} />
      </div>
    </div>
  );
}
