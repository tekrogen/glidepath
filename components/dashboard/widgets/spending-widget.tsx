import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import type { SpendingWidgetData } from "@/app/(dashboard)/dashboard/types";

interface SpendingWidgetProps {
  data: SpendingWidgetData;
}

export function SpendingWidget({ data }: SpendingWidgetProps) {
  const diff = data.currentAmount - data.previousAmount;
  const percentChange = data.previousAmount > 0
    ? ((diff / data.previousAmount) * 100)
    : 0;
  const isUp = diff > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending</CardTitle>
        <CardDescription className="text-sm">
          {data.period}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.currentAmount === 0 && data.previousAmount === 0 ? (
          <p className="text-sm text-muted-foreground">
            No spending data yet —{" "}
            <Link href="/settings" className="text-blue-600 hover:underline">
              connect accounts
            </Link>{" "}
            to track spending.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-2xl font-bold">
              ${data.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {data.previousAmount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                {isUp ? (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-600" />
                )}
                <span className={isUp ? 'text-red-600' : 'text-green-600'}>
                  {isUp ? '+' : ''}{percentChange.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
