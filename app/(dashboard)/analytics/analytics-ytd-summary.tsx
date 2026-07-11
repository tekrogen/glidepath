"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface YTDSummaryProps {
  yearToDate: {
    income: number;
    expenses: number;
    netSavings: number;
  };
  savingsRate: number;
}

export function AnalyticsYTDSummary({ yearToDate, savingsRate }: YTDSummaryProps) {
  const items = [
    { label: "YTD Income", value: yearToDate.income, color: "text-green-600" },
    { label: "YTD Expenses", value: yearToDate.expenses, color: "text-red-600" },
    {
      label: "YTD Net Savings",
      value: yearToDate.netSavings,
      color: yearToDate.netSavings >= 0 ? "text-green-600" : "text-red-600",
    },
  ];

  // Savings rate progress bar
  const clampedRate = Math.max(0, Math.min(100, savingsRate));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Year-to-Date Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className={`text-sm font-medium tabular-nums ${item.color}`}>
              ${formatCurrency(Math.abs(item.value))}
            </span>
          </div>
        ))}

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Savings Rate</span>
            <span className={`text-sm font-bold ${savingsRate >= 20 ? "text-green-600" : savingsRate >= 0 ? "text-yellow-600" : "text-red-600"}`}>
              {savingsRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${savingsRate >= 20 ? "bg-green-500" : savingsRate >= 0 ? "bg-yellow-500" : "bg-red-500"}`}
              style={{ width: `${clampedRate}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {savingsRate >= 20
              ? "Great savings rate!"
              : savingsRate >= 10
                ? "Good start — aim for 20%+"
                : savingsRate >= 0
                  ? "Consider reducing expenses to boost savings"
                  : "Spending exceeds income this year"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
