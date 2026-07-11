import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccountsData } from "@/lib/services/account-service";
import { AccountsEmptyState } from "./accounts-empty-state";
import { AccountsHeader } from "./accounts-header";
import { AccountsChart } from "./accounts-chart";
import { AccountsList } from "./accounts-list";
import { AccountsSummary } from "./accounts-summary";

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/accounts");
  }

  const data = await getAccountsData(session.user.id);

  // Empty state
  if (data.accountGroups.length === 0) {
    return <AccountsEmptyState />;
  }

  // Flatten all accounts for CSV export
  const allAccounts = data.accountGroups.flatMap((g) =>
    g.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      institution: a.institution,
      balance: a.balance,
      accountNumber: a.accountNumber,
    }))
  );

  return (
    <div className="space-y-6">
      {/* Header: Filter by owner, Edit owners, Refresh all, + Add account */}
      <AccountsHeader />

      {/* Main Grid: chart + accounts | summary sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Chart + Account Groups */}
        <div className="lg:col-span-2 space-y-6">
          {/* Net Worth Chart */}
          <AccountsChart
            chartData={data.chartData}
            netWorth={data.netWorth}
          />

          {/* Account Groups with type badges and sparklines */}
          <AccountsList accountGroups={data.accountGroups} />
        </div>

        {/* Right Column: Summary Sidebar */}
        <div className="lg:col-span-1">
          <AccountsSummary
            totalAssets={data.totalAssets}
            totalLiabilities={data.totalLiabilities}
            assets={data.assets}
            liabilities={data.liabilities}
            allAccounts={allAccounts}
          />
        </div>
      </div>
    </div>
  );
}
