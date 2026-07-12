/**
 * Transactions (all cards) — a DESIGNED placeholder (issue #12, Marti's
 * decision 2026-07-12). There is no card-domain transaction data until Phase 5
 * (#30), so this is honest empty-state copy, not a fake feed: it explains what
 * will appear and offers the ONE flow that exists today — the working add-card
 * sheet (never the unbuilt import UI or the legacy /connect-account path). Same
 * Card chrome as the real widgets so the page reads as one system.
 */
import { Receipt } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { AddCardCta } from "./add-card-cta"

export function TransactionsWidget() {
  return (
    <Card className="flex min-h-80 flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Transactions · all cards</CardTitle>
        <span
          className="inline-flex cursor-default items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/50"
          aria-disabled
          title="Filtering arrives with transactions in a later phase"
        >
          Filter
          <span className="rounded border border-border px-1 py-px text-[9px] tracking-wide text-muted-foreground/70">
            Soon
          </span>
        </span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted" aria-hidden>
          <Receipt className="h-6 w-6 text-muted-foreground" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          Transactions appear here once your cards have activity.
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Adding cards manually works today — start there and activity lands here as it arrives.
        </p>
        <AddCardCta />
      </CardContent>
    </Card>
  )
}
