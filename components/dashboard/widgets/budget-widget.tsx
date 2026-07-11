import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { BudgetWidgetData } from "@/app/(dashboard)/dashboard/types";

interface BudgetWidgetProps {
  data: BudgetWidgetData;
}

export function BudgetWidget({ data }: BudgetWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Budget</CardTitle>
          <Badge variant="secondary" className="text-xs">{data.month}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {data.budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No budgets yet.{" "}
            <Link href="/budgets" className="text-blue-600 hover:underline">
              Set up a budget
            </Link>{" "}
            to track your spending.
          </p>
        ) : (
          <div className="space-y-3">
            {data.budgets.map((budget) => (
              <div key={budget.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{budget.name}</span>
                  <span className="text-muted-foreground">
                    ${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} / ${budget.limit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${budget.percentage > 90 ? 'bg-red-500' : budget.percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
