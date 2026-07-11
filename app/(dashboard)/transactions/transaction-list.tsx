"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";

interface TransactionData {
  id: string;
  description: string;
  merchant: string | null;
  category: string;
  subcategory: string | null;
  amount: number;
  type: string;
  status: string;
  date: string;
  accountName: string;
  accountId: string;
}

interface TransactionsByDate {
  date: string;
  total: number;
  transactions: TransactionData[];
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDetailDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function TransactionList({
  transactionsByDate,
}: {
  transactionsByDate: TransactionsByDate[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {transactionsByDate.map((dayData) => (
        <div key={dayData.date}>
          <div className="flex justify-between items-center mb-3 pb-2 border-b">
            <h3 className="font-medium text-muted-foreground">{dayData.date}</h3>
            <span className="text-sm font-semibold text-muted-foreground">
              ${formatCurrency(dayData.total)}
            </span>
          </div>

          <div className="space-y-1">
            {dayData.transactions.map((tx) => {
              const isExpanded = expandedId === tx.id;
              return (
                <div key={tx.id}>
                  <button
                    onClick={() => toggle(tx.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors group text-left"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="min-w-[150px]">
                        <div className="font-medium truncate">
                          {tx.merchant || tx.description}
                        </div>
                        {tx.merchant && (
                          <div className="text-xs text-muted-foreground truncate">
                            {tx.description}
                          </div>
                        )}
                      </div>
                      <div className="min-w-[150px] hidden md:block">
                        <span className="text-sm text-muted-foreground">
                          {tx.category}
                        </span>
                        {tx.subcategory && (
                          <span className="text-xs text-muted-foreground ml-1">
                            / {tx.subcategory}
                          </span>
                        )}
                      </div>
                      <div className="min-w-[150px] hidden lg:flex items-center gap-2">
                        <span className="text-sm text-muted-foreground truncate">
                          {tx.accountName}
                        </span>
                      </div>
                      {tx.status === "PENDING" && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`font-semibold min-w-[100px] text-right tabular-nums ${
                          tx.type === "INCOME"
                            ? "text-green-600"
                            : tx.type === "TRANSFER"
                              ? "text-blue-600"
                              : ""
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}$
                        {formatCurrency(Math.abs(tx.amount))}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <Card className="ml-3 mr-3 mb-2 border-l-4 border-l-primary/30">
                      <CardContent className="py-4 px-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-0.5">
                              Date
                            </span>
                            <span className="font-medium">
                              {formatDetailDate(tx.date)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">
                              Account
                            </span>
                            <span className="font-medium">{tx.accountName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">
                              Status
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                tx.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : tx.status === "PENDING"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">
                              Category
                            </span>
                            <span className="font-medium">
                              {tx.category}
                              {tx.subcategory && (
                                <span className="text-muted-foreground">
                                  {" / "}
                                  {tx.subcategory}
                                </span>
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">
                              Type
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                tx.type === "INCOME"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : tx.type === "EXPENSE"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              }`}
                            >
                              {tx.type}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">
                              Amount
                            </span>
                            <span
                              className={`font-bold ${
                                tx.type === "INCOME"
                                  ? "text-green-600"
                                  : tx.type === "TRANSFER"
                                    ? "text-blue-600"
                                    : ""
                              }`}
                            >
                              {tx.amount > 0 ? "+" : ""}$
                              {formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </div>
                          {tx.merchant && (
                            <div className="col-span-2 md:col-span-3">
                              <span className="text-muted-foreground block mb-0.5">
                                Description
                              </span>
                              <span className="font-medium">{tx.description}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {transactionsByDate.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No transactions found for the selected filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
