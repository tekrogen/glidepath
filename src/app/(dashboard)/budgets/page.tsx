/**
 * Budgets Page
 *
 * Monthly category budgets vs actual spend. Spent amounts are recomputed
 * from transactions on read so they stay accurate after every sync.
 */

import { redirect } from "next/navigation";
import { PiggyBank, Trash2 } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetFormDialog } from "./budget-form-dialog";
import { deleteBudget } from "./actions";

export const dynamic = "force-dynamic";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default async function BudgetsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/budgets");
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const [budgets, spentByCategory] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId: session.user.id,
        type: "EXPENSE",
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const spentMap = new Map(
    spentByCategory.map((s) => [s.category, Math.abs(Number(s._sum.amount ?? 0))])
  );

  const items = budgets.map((b) => {
    const limit = Number(b.amount);
    const spent = spentMap.get(b.category) ?? 0;
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      limit,
      spent,
      percentage: limit > 0 ? (spent / limit) * 100 : 0,
    };
  });

  const totalLimit = items.reduce((s, b) => s + b.limit, 0);
  const totalSpent = items.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            Monthly spending limits by category — {monthLabel}
          </p>
        </div>
        <BudgetFormDialog />
      </div>

      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This month</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(totalSpent)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                of {formatCurrency(totalLimit)} budgeted
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full transition-all ${
                  totalSpent / Math.max(totalLimit, 1) > 0.9
                    ? "bg-error"
                    : totalSpent / Math.max(totalLimit, 1) > 0.7
                      ? "bg-warning"
                      : "bg-success"
                }`}
                style={{
                  width: `${Math.min((totalSpent / Math.max(totalLimit, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <PiggyBank className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No budgets yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a monthly budget for a spending category to track it here
                and on the dashboard.
              </p>
            </div>
            <BudgetFormDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {b.category}
                    </Badge>
                    <BudgetFormDialog
                      budget={{ id: b.id, name: b.name, category: b.category, amount: b.limit }}
                    />
                    <form action={deleteBudget}>
                      <input type="hidden" name="id" value={b.id} />
                      <Button variant="ghost" size="sm" type="submit">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                        <span className="sr-only">Delete budget</span>
                      </Button>
                    </form>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-xl font-semibold">
                    {formatCurrency(b.spent)}
                  </span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(b.limit)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      b.percentage > 90
                        ? "bg-error"
                        : b.percentage > 70
                          ? "bg-warning"
                          : "bg-success"
                    }`}
                    style={{ width: `${Math.min(b.percentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.percentage > 100
                    ? `${formatCurrency(b.spent - b.limit)} over budget`
                    : `${formatCurrency(b.limit - b.spent)} remaining`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
