import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/services/account-detail-service";
import { AccountDetailHeader } from "./account-detail-header";
import { AccountTransactions } from "./account-transactions";
import { AccountSummaryCard } from "./account-summary-card";

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/accounts");
  }

  const { id } = await params;
  const account = await getAccountDetail(session.user.id, id);

  if (!account) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <AccountDetailHeader account={account} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {account.recentTransactions.length > 0 ? (
            <AccountTransactions transactions={account.recentTransactions} />
          ) : (
            <div className="rounded-lg border p-8 text-center text-muted-foreground">
              No transactions available for this account.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <AccountSummaryCard account={account} />
        </div>
      </div>
    </div>
  );
}
