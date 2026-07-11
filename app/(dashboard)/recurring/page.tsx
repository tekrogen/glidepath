/**
 * Recurring Charges Page
 *
 * Detected subscriptions and other recurring charges, computed on read from
 * transaction history (see lib/services/recurring-detection-service).
 */

import { redirect } from "next/navigation";
import { CalendarClock, Repeat } from "lucide-react";

import { auth } from "@/lib/auth";
import {
  getRecurringCharges,
  monthlyCost,
  type RecurringCharge,
} from "@/lib/services/recurring-detection-service";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const CADENCE_LABEL: Record<RecurringCharge["cadence"], string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  annual: "Yearly",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function RecurringPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/recurring");
  }

  const charges = await getRecurringCharges(session.user.id);
  const totalMonthly = charges.reduce((sum, c) => sum + monthlyCost(c), 0);
  const now = Date.now();
  const upcoming = charges.filter(
    (c) => c.nextExpectedDate.getTime() >= now
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Recurring charges
        </h1>
        <p className="text-muted-foreground">
          Subscriptions and repeating payments detected from your transaction
          history.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated monthly total</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(totalMonthly)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {charges.length} detected recurring charge
              {charges.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Due soon</CardDescription>
            <CardTitle className="text-3xl">{upcoming.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Charges expected in the coming cycle
            </p>
          </CardContent>
        </Card>
      </div>

      {charges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No recurring charges detected yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Detection needs at least three occurrences of a charge. Connect
                an account or sync more history to see subscriptions here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All recurring charges</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {charges.map((charge) => (
              <div
                key={`${charge.merchant}-${charge.cadence}`}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{charge.merchant}</p>
                    <Badge variant="secondary">
                      {CADENCE_LABEL[charge.cadence]}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Next expected {formatDate(charge.nextExpectedDate)} ·{" "}
                    {charge.category}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold">
                    {formatCurrency(charge.averageAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {formatCurrency(monthlyCost(charge))}/month ·{" "}
                    {charge.occurrences} charges seen
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
