"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Landmark,
  CreditCard,
  PiggyBank,
  Wallet,
  Eye,
} from "lucide-react";
import Link from "next/link";
import type { AccountGroup } from "@/lib/services/account-service";

// ─── Types ──────────────────────────────────────────────────────────

interface AccountsListProps {
  accountGroups: AccountGroup[];
}

// ─── Constants ──────────────────────────────────────────────────────

const GROUP_ICONS: Record<string, typeof Wallet> = {
  Cash: Wallet,
  "Credit Cards": CreditCard,
  Loans: Landmark,
};

const GROUP_COLORS: Record<string, string> = {
  Cash: "hsl(var(--primary))",
  "Credit Cards": "hsl(0 72% 51%)",
  Loans: "hsl(25 95% 53%)",
};

// Map raw DB type to friendly display label
const TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT: "Credit Card",
  LOAN: "Loan",
};

// ─── Helpers ────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────

export function AccountsList({ accountGroups }: AccountsListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [showHidden, setShowHidden] = useState(false);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Count hidden/inactive accounts (for "Show N hidden accounts")
  const hiddenCount = 0; // Will be wired when we add hide/show account feature

  return (
    <div className="space-y-5">
      {/* Account Groups */}
      {accountGroups.map((group) => {
        const GroupIcon = GROUP_ICONS[group.name] || PiggyBank;
        const isCollapsed = collapsedGroups.has(group.name);
        const accentColor =
          GROUP_COLORS[group.name] || "hsl(var(--muted-foreground))";

        return (
          <div key={group.name} className="space-y-2">
            {/* Group Header — Monarch style with change info */}
            <button
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between w-full py-1"
            >
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 flex items-center justify-center">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <GroupIcon
                  className="h-4 w-4"
                  style={{ color: accentColor }}
                />
                <h2 className="text-sm font-semibold">{group.name}</h2>
              </div>
              <div className="text-sm font-bold tabular-nums">
                ${formatCurrency(group.totalBalance)}
              </div>
            </button>

            {/* Account Rows */}
            {!isCollapsed && (
              <div className="space-y-1.5 pl-1">
                {group.accounts.map((account) => (
                  <Link key={account.id} href={`/accounts/${account.id}`}>
                    <Card className="hover:shadow-sm transition-shadow cursor-pointer border-0 shadow-none bg-muted/30 hover:bg-muted/60">
                      <CardContent className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          {/* Left: Icon + Name + Badges */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Institution circle icon */}
                            <div
                              className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: accentColor }}
                            >
                              {account.institution.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-sm truncate">
                                {account.name}
                                {account.accountNumber && (
                                  <span className="text-muted-foreground ml-1 font-normal">
                                    ({account.accountNumber})
                                  </span>
                                )}
                              </h3>
                              {/* Account type badges — Monarch style */}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal"
                                >
                                  {TYPE_LABELS[account.type] || account.type}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {account.institution}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Balance + Time */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold tabular-nums">
                              ${formatCurrency(account.balance)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {timeSince(account.updatedAt)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Show hidden accounts — Monarch style */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowHidden(!showHidden)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pl-1 py-2"
        >
          <Eye className="h-4 w-4" />
          {showHidden
            ? "Hide hidden accounts"
            : `Show ${hiddenCount} hidden accounts`}
        </button>
      )}
    </div>
  );
}
