/**
 * Upcoming-payments widget (issue #12, 0b wireframe) — the real feed. Server
 * component: rows arrive already built + sorted by buildUpcomingPayments;
 * cents are serialized here at the RSC boundary. The amount is the RECORDED
 * minimum, an actual — rendered plain with no "~"/EstimatedValue (EDR-020
 * reserves the estimate marker for estimates). Per the wireframe each row
 * carries a disabled "Pay · Soon" affordance and a static "Auto" chip (no
 * autopay/payments model exists yet — Phase 3).
 */
import { CalendarClock } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMinor, formatShortDate } from "@/lib/formatting"
import type { UpcomingPayment } from "../utils/build-upcoming-payments"

import { AddCardCta } from "./add-card-cta"

export function UpcomingPaymentsWidget({ items }: { items: UpcomingPayment[] }) {
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
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.cardId}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
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
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className="inline-flex cursor-default items-center gap-1 px-1.5 text-xs font-medium text-muted-foreground/50"
                    aria-disabled
                    title="Payments arrive in a later phase"
                  >
                    Pay
                    <span className="rounded border border-border px-1 py-px text-[9px] tracking-wide text-muted-foreground/70">
                      Soon
                    </span>
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Auto
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
