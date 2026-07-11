"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";

export function AccountsHeader() {
  const router = useRouter();
  const [refreshing, startRefreshTransition] = useTransition();
  const [ownerFilter, setOwnerFilter] = useState("all");

  const handleRefreshAll = async () => {
    startRefreshTransition(async () => {
      try {
        const itemsRes = await fetch("/api/plaid/items");
        if (!itemsRes.ok) return;
        const { items } = await itemsRes.json();

        for (const item of items) {
          try {
            await fetch(`/api/plaid/sync/${item.id}`, { method: "POST" });
          } catch {
            // Continue syncing other items
          }
        }

        router.refresh();
      } catch {
        // Silent failure
      }
    });
  };

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
      <div className="flex items-center gap-2">
        {/* Filter by owner — Monarch style */}
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background text-foreground cursor-pointer"
        >
          <option value="all">Filter by owner...</option>
          <option value="me">Me</option>
          <option value="shared">Shared</option>
        </select>

        {/* Edit owners */}
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit owners
        </Button>

        {/* Refresh all */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh all"}
        </Button>

        {/* + Add account */}
        <PlaidLinkButton variant="default" label="+ Add account" size="sm" />
      </div>
    </div>
  );
}
