"use client";

import Link from "next/link";
import { ArrowLeft, Building2, CreditCard, Landmark, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountDetail } from "@/lib/services/account-detail-service";

const TYPE_ICONS: Record<string, typeof Building2> = {
  CHECKING: Landmark,
  SAVINGS: Wallet,
  CREDIT: CreditCard,
  LOAN: Building2,
};

const TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT: "Credit Card",
  LOAN: "Loan",
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AccountDetailHeader({ account }: { account: AccountDetail }) {
  const Icon = TYPE_ICONS[account.type] || Building2;
  const typeLabel = TYPE_LABELS[account.type] || account.type;

  return (
    <div className="space-y-4">
      <Link href="/accounts">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </Button>
      </Link>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{account.institution}</span>
              {account.accountNumber && (
                <>
                  <span>&middot;</span>
                  <span>{account.accountNumber}</span>
                </>
              )}
              <span>&middot;</span>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                {typeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">
            ${formatCurrency(account.balance)}
          </div>
        </div>
      </div>
    </div>
  );
}
