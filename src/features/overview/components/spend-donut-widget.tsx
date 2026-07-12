/**
 * Spend by category — a DESIGNED placeholder (issue #12, Marti's decision
 * 2026-07-12). No category/transaction data exists until Insights (Phase 5),
 * so this shows an honest muted placeholder ring, not a fabricated chart or a
 * chart-library dependency. Same Card chrome as the real widgets.
 */
import { PieChart } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SpendDonutWidget() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Spend by category</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
        <span
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-border"
          aria-hidden
        >
          <PieChart className="h-8 w-8 text-muted-foreground/60" />
        </span>
        <p className="text-sm text-muted-foreground">Arrives with Insights.</p>
      </CardContent>
    </Card>
  )
}
