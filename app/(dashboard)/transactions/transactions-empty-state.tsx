"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";

export function TransactionsEmptyState() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Receipt className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No transactions yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect a bank account to automatically sync your transactions.
            Your spending, income, and transfers will appear here.
          </p>
          <PlaidLinkButton />
        </CardContent>
      </Card>
    </div>
  );
}
