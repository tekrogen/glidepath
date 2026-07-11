import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTransactionsData } from "@/lib/services/transaction-service";
import { TransactionsEmptyState } from "./transactions-empty-state";
import { TransactionList } from "./transaction-list";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Date-range options for the transactions view. `days: null` = all history.
const RANGES = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

const DEFAULT_RANGE = "90d";

function resolveDateFrom(rangeKey: string): Date {
  const match =
    RANGES.find((r) => r.key === rangeKey) ??
    RANGES.find((r) => r.key === DEFAULT_RANGE)!;
  if (match.days === null) return new Date("2000-01-01"); // "all"
  const from = new Date();
  from.setDate(from.getDate() - match.days);
  return from;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; category?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/transactions");
  }

  const { range, category } = await searchParams;
  const activeRange = RANGES.some((r) => r.key === range) ? range! : DEFAULT_RANGE;
  const activeCategory = category?.trim() || undefined;

  const data = await getTransactionsData(session.user.id, {
    dateFrom: resolveDateFrom(activeRange),
    category: activeCategory,
  });
  const { transactionsByDate, summary } = data;
  const hasTransactions = summary.totalTransactions > 0;

  // CSV export URL — preserves the active range + category filters
  const exportParams = new URLSearchParams({ range: activeRange });
  if (activeCategory) {
    exportParams.set("category", activeCategory);
  }
  const exportUrl = `/api/transactions/export?${exportParams.toString()}`;

  // Preserve the category filter across range navigation
  const rangeHref = (rangeKey: string) => {
    const params = new URLSearchParams({ range: rangeKey });
    if (activeCategory) {
      params.set("category", activeCategory);
    }
    return `/transactions?${params.toString()}`;
  };

  // Serialize dates for client component
  const serializedGroups = transactionsByDate.map((group) => ({
    date: group.date,
    total: group.total,
    transactions: group.transactions.map((tx) => ({
      id: tx.id,
      description: tx.description,
      merchant: tx.merchant,
      category: tx.category,
      subcategory: tx.subcategory,
      amount: tx.amount,
      type: tx.type,
      status: tx.status,
      date: tx.date.toISOString(),
      accountName: tx.accountName,
      accountId: tx.accountId,
    })),
  }));

  return (
    <div className="space-y-6">
      {/* Header with range selector + Action Buttons */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <div className="flex items-center gap-2">
          {/* Date-range selector — server-navigated via ?range= */}
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                asChild
                size="sm"
                variant={activeRange === r.key ? "default" : "outline"}
              >
                <Link href={rangeHref(r.key)} scroll={false}>
                  {r.label}
                </Link>
              </Button>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </a>
          </Button>
        </div>
      </div>

      {!hasTransactions ? (
        <TransactionsEmptyState />
      ) : (
        <>
          {/* Summary Section */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Total transactions
                  </div>
                  <div className="text-2xl font-bold">
                    {summary.totalTransactions}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Largest transaction
                  </div>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(summary.largestTransaction)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Largest expense
                  </div>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(summary.largestExpense)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Average transaction
                  </div>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(summary.averageTransaction)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Total income
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    +${formatCurrency(summary.totalIncome)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Total spending
                  </div>
                  <div className="text-2xl font-bold">
                    ${formatCurrency(summary.totalSpending)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    First transaction
                  </div>
                  <div className="text-lg font-semibold">
                    {formatDate(summary.firstTransactionDate)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Last transaction
                  </div>
                  <div className="text-lg font-semibold">
                    {formatDate(summary.lastTransactionDate)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions List with Expandable Detail */}
          <TransactionList transactionsByDate={serializedGroups} />
        </>
      )}
    </div>
  );
}
