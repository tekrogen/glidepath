"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Percent, CreditCard } from "lucide-react";
import type { AnalyticsMetrics as Metrics } from "@/lib/services/analytics-service";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function AnalyticsMetrics({ metrics }: { metrics: Metrics }) {
  const cards = [
    {
      title: "Income This Month",
      icon: DollarSign,
      value: `$${formatCurrency(metrics.monthlyIncome)}`,
      valueColor: "text-green-600",
      subtitle: "Total income this month",
    },
    {
      title: "Spending This Month",
      icon: CreditCard,
      value: `$${formatCurrency(metrics.monthlySpending)}`,
      valueColor: "",
      subtitle: "Total expenses this month",
    },
    {
      title: "Spending Trend",
      icon: metrics.spendingTrend <= 0 ? TrendingDown : TrendingUp,
      value: formatPercent(metrics.spendingTrend),
      valueColor: metrics.spendingTrend <= 0 ? "text-green-600" : "text-red-600",
      subtitle: `${metrics.spendingTrendAmount >= 0 ? "+" : "-"}$${formatCurrency(Math.abs(metrics.spendingTrendAmount))} vs last month`,
    },
    {
      title: "Savings Rate",
      icon: Percent,
      value: `${metrics.savingsRate.toFixed(1)}%`,
      valueColor: metrics.savingsRate >= 20 ? "text-green-600" : metrics.savingsRate >= 0 ? "text-yellow-600" : "text-red-600",
      subtitle: "Year-to-date",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.valueColor}`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
