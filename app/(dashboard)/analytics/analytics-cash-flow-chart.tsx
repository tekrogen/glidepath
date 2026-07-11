"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { MonthlyFlow } from "@/lib/services/analytics-service";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function AnalyticsCashFlowChart({ data }: { data: MonthlyFlow[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expenses > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cash Flow</CardTitle>
          <CardDescription>Income vs expenses over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No transaction data yet. Connect an account to see your cash flow.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Cash Flow</CardTitle>
        <CardDescription>Income vs expenses over the last 12 months</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${formatCurrency(v)}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const income = Number(payload[0]?.value || 0);
                    const expenses = Number(payload[1]?.value || 0);
                    const net = income - expenses;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium mb-1">{label}</p>
                        <p className="text-sm text-green-600">
                          Income: ${formatCurrency(income)}
                        </p>
                        <p className="text-sm text-red-600">
                          Expenses: ${formatCurrency(expenses)}
                        </p>
                        <p className={`text-sm font-medium mt-1 ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                          Net: {net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(net))}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(142, 71%, 45%)"
                fillOpacity={1}
                fill="url(#colorIncome)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(0, 72%, 51%)"
                fillOpacity={1}
                fill="url(#colorExpenses)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
