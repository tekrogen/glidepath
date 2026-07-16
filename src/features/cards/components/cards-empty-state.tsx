/**
 * Cards zero-card empty state (issue #29, Gap G5). Idiom B (the #12 widget
 * pattern): muted icon circle, heading, two-tier body, then the working
 * add-card CTA plus the tracker-import entry point (#28). Rendered by
 * the Cards page in place of the table when the portfolio has no cards.
 */
import Link from "next/link"
import { CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AddCardCta } from "@/features/overview/components/add-card-cta"

export function CardsEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
          aria-hidden
        >
          <CreditCard className="h-6 w-6 text-muted-foreground" />
        </span>
        <h2 className="font-heading text-xl font-semibold">No cards yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add a card to start tracking balances, utilization, and due dates in one place.
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Manual entry works today — you&rsquo;re always in control.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <AddCardCta label="Add a card" />
          <Button variant="outline" asChild>
            <Link href="/cards/import">Import from tracker</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
