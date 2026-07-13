/**
 * Overview zero-card first-run (issue #29, Gap G5). Replaces the raw $0.00
 * header + metric grid + hidden panels with one designed welcome when the
 * household has no cards yet. Server component; it embeds the client
 * <AddCardCta> — the ONLY working "get started" flow (#28 import UI does not
 * exist, so this never links a phantom import route or /connect-account).
 * Keeps a Syne <h1> on /overview for a11y + theme parity (theme-and-shell).
 */
import { CalendarClock, CreditCard, PieChart, TrendingDown } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

import { AddCardCta } from "./add-card-cta"

const HINTS = [
  { icon: TrendingDown, title: "Paydown priority", body: "See which balance to attack first." },
  { icon: CalendarClock, title: "Upcoming payments", body: "Every due date across every card." },
  { icon: PieChart, title: "0% promo payoff", body: "Clear promo balances before they expire." },
] as const

export function OverviewFirstRun() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Welcome to Glidepath
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight">Let&rsquo;s map your glidepath</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            aria-hidden
          >
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </span>
          <h2 className="font-heading text-xl font-semibold">Add your first card</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Add cards manually — you&rsquo;re always in control. Connect an aggregator later, once
            you&rsquo;re ready.
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Have a spreadsheet? The tracker-import CLI works today; an import screen is on the way.
          </p>
          <AddCardCta label="Add your first card" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {HINTS.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="flex flex-col gap-2 py-6">
              <Icon className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
