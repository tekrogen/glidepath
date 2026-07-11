import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import type { CreditCardsWidgetData } from "@/app/(dashboard)/dashboard/types";

interface CreditCardsWidgetProps {
  data: CreditCardsWidgetData;
}

export function CreditCardsWidget({ data }: CreditCardsWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Credit cards</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-sm">Total balance owed</CardDescription>
      </CardHeader>
      <CardContent>
        {!data.hasConnectedAccounts ? (
          <p className="text-sm text-muted-foreground">
            No cards connected yet.{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Connect a card
            </Link>{" "}
            to see balances here.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-2xl font-bold">
              ${data.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="space-y-2">
              {data.cards.map((card) => (
                <Link
                  key={card.id}
                  href={`/accounts/${card.id}`}
                  className="flex items-center justify-between text-sm hover:text-primary"
                >
                  <span className="truncate">
                    {card.name}
                    {card.accountNumber && (
                      <span className="ml-1 text-muted-foreground">{card.accountNumber}</span>
                    )}
                  </span>
                  <span className="font-medium">
                    ${card.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
