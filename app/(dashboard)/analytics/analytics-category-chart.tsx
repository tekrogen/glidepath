"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import type { CategoryBreakdown } from "@/lib/services/analytics-service";

const CATEGORY_COLORS = [
  "hsl(var(--primary))",
  "hsl(196, 80%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(25, 95%, 53%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
  "hsl(45, 90%, 50%)",
  "hsl(170, 60%, 45%)",
  "hsl(210, 70%, 55%)",
  "hsl(0, 72%, 51%)",
];

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function AnalyticsCategoryChart({ data }: { data: CategoryBreakdown[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
          <CardDescription>This month&apos;s expense breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No expenses this month yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show top 10 categories
  const top = data.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
        <CardDescription>This month&apos;s expense breakdown</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${formatCurrency(v)}`}
              />
              <YAxis
                type="category"
                dataKey="category"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={75}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0]?.payload as CategoryBreakdown;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium">{item.category}</p>
                        <p className="text-sm">${formatCurrency(item.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.percentage}% of spending ({item.count} transactions)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {top.map((_, idx) => (
                  <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
