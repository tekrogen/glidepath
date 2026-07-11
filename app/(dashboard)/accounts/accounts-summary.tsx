"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface SummaryItem {
  name: string;
  amount: number;
}

interface AccountRow {
  name: string;
  type: string;
  institution: string;
  balance: number;
  accountNumber: string | null;
}

interface AccountsSummaryProps {
  totalAssets: number;
  totalLiabilities: number;
  assets: SummaryItem[];
  liabilities: SummaryItem[];
  allAccounts: AccountRow[];
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Monarch-style color palette for account groups
const GROUP_COLORS: Record<string, string> = {
  Cash: "hsl(var(--primary))",
  "Credit Cards": "hsl(0 72% 51%)",
  Loans: "hsl(25 95% 53%)",
  Other: "hsl(var(--muted-foreground))",
};

function getGroupColor(name: string): string {
  return GROUP_COLORS[name] || GROUP_COLORS.Other;
}

// ─── Component ──────────────────────────────────────────────────────

export function AccountsSummary({
  totalAssets,
  totalLiabilities,
  assets,
  liabilities,
  allAccounts,
}: AccountsSummaryProps) {
  const [showPercent, setShowPercent] = useState(false);

  const assetsWithColors = assets.map((a) => ({
    ...a,
    color: getGroupColor(a.name) as string,
  }));

  const liabilitiesWithColors = liabilities.map((l) => ({
    ...l,
    color: getGroupColor(l.name) as string,
  }));

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Summary</CardTitle>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setShowPercent(false)}
              className={`px-2 py-1 rounded transition-colors ${
                !showPercent
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Value
            </button>
            <button
              onClick={() => setShowPercent(true)}
              className={`px-2 py-1 rounded transition-colors ${
                showPercent
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Percent
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Assets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Assets</h3>
            <span className="text-sm font-bold">
              ${formatCurrency(totalAssets)}
            </span>
          </div>
          {/* Stacked progress bar */}
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {assetsWithColors.map((item) => {
              const pct =
                totalAssets > 0 ? (item.amount / totalAssets) * 100 : 0;
              return (
                <div
                  key={item.name}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.color,
                  }}
                  title={`${item.name}: $${formatCurrency(item.amount)}`}
                />
              );
            })}
          </div>
          <div className="space-y-1.5">
            {assetsWithColors.map((item) => {
              const pct =
                totalAssets > 0 ? (item.amount / totalAssets) * 100 : 0;
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-sm py-1 px-1 rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-medium tabular-nums">
                    {showPercent
                      ? `${pct.toFixed(0)}%`
                      : `$${formatCurrency(item.amount)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Liabilities */}
        {liabilitiesWithColors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Liabilities</h3>
              <span className="text-sm font-bold">
                ${formatCurrency(totalLiabilities)}
              </span>
            </div>
            {/* Stacked progress bar */}
            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              {liabilitiesWithColors.map((item) => {
                const pct =
                  totalLiabilities > 0
                    ? (item.amount / totalLiabilities) * 100
                    : 0;
                return (
                  <div
                    key={item.name}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: item.color,
                    }}
                    title={`${item.name}: $${formatCurrency(item.amount)}`}
                  />
                );
              })}
            </div>
            <div className="space-y-1.5">
              {liabilitiesWithColors.map((item) => {
                const pct =
                  totalLiabilities > 0
                    ? (item.amount / totalLiabilities) * 100
                    : 0;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-sm py-1 px-1 rounded hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {showPercent
                        ? `${pct.toFixed(0)}%`
                        : `$${formatCurrency(item.amount)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full text-sm"
          onClick={() => {
            // Build CSV content
            const headers = ["Account Name", "Type", "Institution", "Account Number", "Balance"];
            const rows = allAccounts.map((a) => [
              a.name,
              a.type,
              a.institution,
              a.accountNumber || "",
              a.balance.toFixed(2),
            ]);
            const csv = [
              headers.join(","),
              ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
              "",
              `"Total Assets","","","","${formatCurrency(totalAssets)}"`,
              `"Total Liabilities","","","","${formatCurrency(totalLiabilities)}"`,
              `"Net Worth","","","","${formatCurrency(totalAssets - totalLiabilities)}"`,
            ].join("\n");

            // Trigger download
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `accounts-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </CardContent>
    </Card>
  );
}
