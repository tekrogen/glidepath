/**
 * Upcoming-payments widget (issue #12, 0b wireframe) — the real feed. Server
 * component: rows arrive already built + sorted by buildUpcomingPayments;
 * cents are serialized here at the RSC boundary. The amount is the RECORDED
 * minimum, an actual — rendered plain with no "~"/EstimatedValue (EDR-020
 * reserves the estimate marker for estimates). The list is capped to the next
 * few due items with a muted "+ N more" tally; a single widget-footer note
 * stands in for per-row pay/autopay affordances (no payments model exists yet
 * — Phase 3), keeping each row to date · card · amount so names render fully
 * (design QA).
 */
import Link from "next/link"
import { CalendarClock } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMinor, formatShortDate } from "@/lib/formatting"
import type { UpcomingPayment } from "../utils/build-upcoming-payments"

import { AddCardCta } from "./add-card-cta"

const UPCOMING_LIMIT = 6

export function UpcomingPaymentsWidget({ items }: { items: UpcomingPayment[] }) {
  const shown = items.slice(0, UPCOMING_LIMIT)
  const remaining = items.length - shown.length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Upcoming payments</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              No upcoming payments — add a card with a due date to track it here.
            </p>
            <AddCardCta />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {shown.map((item) => (
                <li
                  key={item.cardId}
                  className="flex items-center gap-3 py-2.5 first:pt-0"
                  data-testid="upcoming-payment"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.cardName}</p>
                    <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                      {formatShortDate(item.dueDate)}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">
                    {item.minimumPaymentMinor == null ? (
                      <span className="text-muted-foreground">Min not set</span>
                    ) : (
                      formatMinor(Number(item.minimumPaymentMinor))
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <p className="pt-3 text-xs text-muted-foreground">
                + {remaining} more due this cycle
              </p>
            )}
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <Link
                href="/payments/new"
                className="text-primary underline-offset-2 hover:underline"
              >
                Schedule a payment
              </Link>{" "}
              — autopay arrives with reminders.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
