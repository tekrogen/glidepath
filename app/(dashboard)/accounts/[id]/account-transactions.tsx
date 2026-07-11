"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TransactionDetail } from "@/lib/services/account-detail-service";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AccountTransactions({
  transactions,
}: {
  transactions: TransactionDetail[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Recent Transactions</span>
          <span className="text-sm font-normal text-muted-foreground">
            Last 30 days ({transactions.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/50 rounded px-1"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {tx.merchant || tx.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(tx.date)}</span>
                  <span>&middot;</span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                    {tx.category}
                  </span>
                </div>
              </div>
              <span
                className={`text-sm font-medium tabular-nums ml-4 ${
                  tx.type === "INCOME"
                    ? "text-green-600"
                    : tx.type === "EXPENSE"
                      ? "text-red-600"
                      : "text-muted-foreground"
                }`}
              >
                {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}$
                {formatCurrency(Math.abs(tx.amount))}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
