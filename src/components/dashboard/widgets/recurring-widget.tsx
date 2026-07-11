import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Repeat } from "lucide-react";
import Link from "next/link";
import type { RecurringWidgetData } from "@/app/(dashboard)/dashboard/types";

interface RecurringWidgetProps {
  data: RecurringWidgetData;
}

export function RecurringWidget({ data }: RecurringWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recurring</CardTitle>
          <Link href="/recurring">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>
        <CardDescription className="text-sm">
          Subscriptions and repeating charges
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.count === 0 ? (
          <div className="py-4 text-center text-muted-foreground">
            <Repeat className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">
              No recurring charges detected yet. They appear after three
              occurrences of a charge.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-2xl font-bold">
              ${data.monthlyTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
            </div>
            <div className="space-y-2">
              {data.items.map((item) => (
                <div
                  key={item.merchant}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{item.merchant}</span>
                  <span className="shrink-0 text-muted-foreground">
                    ${item.averageAmount.toFixed(2)} · {item.nextExpectedDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
