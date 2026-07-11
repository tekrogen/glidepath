import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAnalyticsData } from "@/lib/services/analytics-service";
import { AnalyticsMetrics } from "./analytics-metrics";
import { AnalyticsCashFlowChart } from "./analytics-cash-flow-chart";
import { AnalyticsCategoryChart } from "./analytics-category-chart";
import { AnalyticsYTDSummary } from "./analytics-ytd-summary";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/analytics");
  }

  const data = await getAnalyticsData(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">
          Insights into your financial patterns and trends
        </p>
      </div>

      {/* Key Metrics */}
      <AnalyticsMetrics metrics={data.metrics} />

      {/* Charts Row: Cash Flow + Category Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <AnalyticsCashFlowChart data={data.monthlyFlow} />
        <AnalyticsCategoryChart data={data.categoryBreakdown} />
      </div>

      {/* Bottom Row: YTD Summary */}
      <div className="grid gap-6 md:grid-cols-3">
        <AnalyticsYTDSummary
          yearToDate={data.yearToDate}
          savingsRate={data.metrics.savingsRate}
        />
      </div>
    </div>
  );
}
