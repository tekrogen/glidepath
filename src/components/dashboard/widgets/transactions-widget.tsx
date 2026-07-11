import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, DollarSign } from "lucide-react";
import Link from "next/link";
import type { RecentTransaction } from "@/app/(dashboard)/dashboard/types";

interface TransactionsWidgetProps {
  transactions: RecentTransaction[];
}

export function TransactionsWidget({ transactions }: TransactionsWidgetProps) {
  return (
    <Link href="/transactions" className="block md:col-span-2">
      <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Most recent</span>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transactions yet — connect accounts in Settings to see activity.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{tx.merchant}</div>
                      <div className="text-xs text-muted-foreground">{tx.category}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
