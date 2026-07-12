/**
 * Overview attention feed (issue #25) — panel composition per the paydown /
 * promo panels. Pure presentation: items arrive already built and sorted by
 * the attention builder (strings only).
 */
import { BellRing } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import type { AttentionItem } from "../utils/build-attention-items"
import { AttentionItemRow } from "./attention-item"

export function DashboardAttention({ items }: { items: AttentionItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Needs Attention</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? "Every card is inside its thresholds."
            : `${items.length} ${items.length === 1 ? "item" : "items"} across the portfolio, most urgent first.`}
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">All clear — nothing needs attention.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <AttentionItemRow key={item.dedupeKey} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
