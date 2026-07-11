"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Landmark } from "lucide-react";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";

export function AccountsEmptyState() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Landmark className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No accounts connected</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect your bank accounts to see your balances, track spending, and
            get a complete view of your finances.
          </p>
          <PlaidLinkButton />
        </CardContent>
      </Card>
    </div>
  );
}
