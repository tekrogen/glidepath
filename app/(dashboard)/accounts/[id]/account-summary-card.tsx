"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountDetail } from "@/lib/services/account-detail-service";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AccountSummaryCard({ account }: { account: AccountDetail }) {
  return (
    <div className="space-y-4">
      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Institution</span>
            <span className="font-medium">{account.institution}</span>
          </div>
          {account.accountNumber && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account</span>
              <span className="font-medium">{account.accountNumber}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium capitalize">{account.type.toLowerCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Last Updated</span>
            <span className="font-medium">{formatDate(account.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Summary (if has transactions) */}
      {account.transactionSummary.transactionCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">30-Day Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium tabular-nums text-green-600">
                +${formatCurrency(account.transactionSummary.totalIncome)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium tabular-nums text-red-600">
                -${formatCurrency(account.transactionSummary.totalExpenses)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Transactions</span>
              <span className="font-medium">{account.transactionSummary.transactionCount}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
