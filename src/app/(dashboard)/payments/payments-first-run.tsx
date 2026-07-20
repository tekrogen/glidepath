/**
 * Zero-card first run for the Payments page (issue #44) — a designed
 * branch instead of an empty lane board (the G5 empty-state rule).
 */
import { CalendarClock } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AddCardCta } from "@/features/overview/components/add-card-cta"

export function PaymentsFirstRun() {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Payment runway
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight">Payments</h1>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CalendarClock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>No cards to plan yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            The runway plots every card&apos;s due dates, statement closes, and scheduled
            payments across the next 45 days. Add a card with a due date to start.
          </p>
          <AddCardCta />
        </CardContent>
      </Card>
    </div>
  )
}
