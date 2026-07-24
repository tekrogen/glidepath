/**
 * Upcoming-payments widget (issue #12, 0b wireframe; PAY/AUTO chips per
 * wireframe 1a — issue #46). Server component: rows arrive already built +
 * sorted by buildUpcomingPayments; cents are serialized here at the RSC
 * boundary. The amount is the RECORDED minimum, an actual — rendered plain
 * with no "~"/EstimatedValue (EDR-020 reserves the estimate marker for
 * estimates). Per-row affordances (EDR-016, record-only): confirmed
 * provider autopay → muted "Auto ✓" chip; else a recorded issuer page →
 * "Pay ↗" link-out. The list is capped with a muted "+ N more" tally.
 */
import Link from "next/link"
import { CalendarClock, ExternalLink } from "lucide-react"

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
                  {/* Fixed trailing slot keeps the amount column's right axis
                      whether or not a chip renders (design QA DS-010); chip
                      TEXT stays foreground per the AA chip contract (DS-008). */}
                  <span className="flex w-16 shrink-0 justify-end">
                    {item.autopayActive ? (
                      <span
                        className="rounded-full border border-success/50 bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground"
                        title="Autopay is set up at the issuer"
                        data-testid="autopay-chip"
                      >
                        Auto ✓
                      </span>
                    ) : item.autopayProviderUrl ? (
                      <a
                        href={item.autopayProviderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        title="Pay at the issuer (opens in a new tab)"
                        data-testid="pay-link"
                      >
                        Pay
                        <ExternalLink className="h-3 w-3 text-primary" aria-hidden />
                        <span className="sr-only">
                          {item.cardName} at the issuer (opens in a new tab)
                        </span>
                      </a>
                    ) : null}
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
              — Auto ✓ means autopay is confirmed at the issuer.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
