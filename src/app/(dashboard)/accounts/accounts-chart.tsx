"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  netWorth: number;
  assets: number;
  liabilities: number;
  cash?: number;
  creditCards?: number;
}

interface AccountsChartProps {
  chartData: ChartDataPoint[];
  netWorth: number;
}

type ChartType = "performance" | "breakdown" | "assets" | "liabilities";
type DateRange = "1M" | "3M" | "6M" | "1Y" | "YTD";

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function filterByDateRange(
  data: ChartDataPoint[],
  range: DateRange
): ChartDataPoint[] {
  if (data.length === 0) return data;
  const now = new Date();
  let cutoff: Date;

  switch (range) {
    case "1M":
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case "3M":
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case "6M":
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case "1Y":
      cutoff = new Date(
        now.getFullYear() - 1,
        now.getMonth(),
        now.getDate()
      );
      break;
    case "YTD":
      cutoff = new Date(now.getFullYear(), 0, 1);
      break;
  }

  const filtered = data.filter((d) => new Date(d.date) >= cutoff);
  return filtered.length > 0 ? filtered : data;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Chart Component ────────────────────────────────────────────────

export function AccountsChart({ chartData, netWorth }: AccountsChartProps) {
  const [chartType, setChartType] = useState<ChartType>("performance");
  const [dateRange, setDateRange] = useState<DateRange>("1M");

  const filteredData = filterByDateRange(chartData, dateRange);

  // Calculate change over the period
  const periodStart = filteredData[0];
  const periodEnd = filteredData[filteredData.length - 1];
  const periodChange =
    periodStart && periodEnd ? periodEnd.netWorth - periodStart.netWorth : 0;
  const periodChangePercent =
    periodStart && periodStart.netWorth !== 0
      ? (periodChange / periodStart.netWorth) * 100
      : 0;
  const isPositive = periodChange >= 0;

  const chartTypeLabels: Record<ChartType, string> = {
    performance: "Net worth performance",
    breakdown: "Net worth breakdown",
    assets: "Assets",
    liabilities: "Liabilities",
  };

  const dateRangeLabels: Record<DateRange, string> = {
    "1M": "1 month",
    "3M": "3 months",
    "6M": "6 months",
    "1Y": "1 year",
    YTD: "Year to date",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Net Worth Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Net Worth
            </p>
            <div className="text-3xl font-bold mt-1">
              ${formatCurrency(netWorth)}
            </div>
            {filteredData.length > 1 && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`flex items-center gap-1 text-sm font-semibold ${
                    isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {isPositive ? "+" : ""}${formatCurrency(Math.abs(periodChange))} (
                  {periodChangePercent >= 0 ? "+" : ""}
                  {periodChangePercent.toFixed(1)}%)
                </span>
                <span className="text-sm text-muted-foreground">
                  {dateRangeLabels[dateRange]}
                </span>
              </div>
            )}
          </div>

          {/* Dropdowns — Monarch-style */}
          <div className="flex items-center gap-2">
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="text-sm border rounded-md px-2 py-1.5 bg-background text-foreground cursor-pointer"
            >
              {Object.entries(chartTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="text-sm border rounded-md px-2 py-1.5 bg-background text-foreground cursor-pointer"
            >
              {Object.entries(dateRangeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart Area */}
        {filteredData.length > 1 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "breakdown" ? (
                <BarChart data={filteredData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    hide
                    domain={["dataMin - 1000", "dataMax + 1000"]}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${formatCurrency(Number(value ?? 0))}`,
                    ]}
                    labelFormatter={(label) => formatDateLabel(String(label))}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar
                    dataKey="cash"
                    stackId="a"
                    fill="hsl(var(--primary))"
                    name="Cash"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="creditCards"
                    stackId="b"
                    fill="hsl(0 72% 51%)"
                    name="Credit Cards"
                    radius={[0, 0, 0, 0]}
                  />
                </BarChart>
              ) : (
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient
                      id="accountsChartGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    hide
                    domain={["dataMin - 1000", "dataMax + 1000"]}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `$${formatCurrency(Number(value ?? 0))}`,
                    ]}
                    labelFormatter={(label) => formatDateLabel(String(label))}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey={
                      chartType === "assets"
                        ? "assets"
                        : chartType === "liabilities"
                          ? "liabilities"
                          : "netWorth"
                    }
                    stroke="hsl(var(--primary))"
                    fill="url(#accountsChartGrad)"
                    strokeWidth={2}
                    name={chartTypeLabels[chartType]}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            Chart will appear after multiple days of data
          </div>
        )}
      </CardContent>
    </Card>
  );
}
