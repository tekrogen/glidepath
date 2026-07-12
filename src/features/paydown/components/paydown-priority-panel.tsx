/**
 * Paydown priority panel. Layout per the mockup (Overview placement +
 * what-if slider inside the panel); styling per Ebia's
 * paydown-priority-panel. Ranks come precomputed from lib/finance.
 */
import { TrendingDown } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMinor, formatPercent, formatShortDate } from "@/lib/formatting"
import type { PortfolioCard } from "@/features/cards/server/service"

import { WhatIfSlider, type WhatIfCardDto } from "./what-if-slider"

export function PaydownPriorityPanel({ cards }: { cards: PortfolioCard[] }) {
  const ranked = cards
    .filter((c) => c.paydownPriority != null)
    .sort((a, b) => a.paydownPriority! - b.paydownPriority!)
  if (ranked.length === 0) return null

  // Serialization boundary: bigint → number cents for the client slider.
  const dtos: WhatIfCardDto[] = ranked.map((c) => ({
    id: c.id,
    cardName: c.cardName,
    balanceCents: Number(c.finance.balanceMinor),
    limitCents: c.finance.limitMinor == null ? null : Number(c.finance.limitMinor),
    regularAprBps: c.finance.regularAprBps,
  }))

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-destructive" />
          <CardTitle className="text-base">Paydown Priority</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {ranked.length} {ranked.length === 1 ? "card is" : "cards are"} at 30%+ utilization —
          paying these down first has the biggest credit-score and interest impact.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {ranked.map((card) => (
            <li
              key={card.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10 text-xs font-bold text-destructive">
                  {card.paydownPriority}
                </span>
                <span className="truncate font-medium">{card.cardName}</span>
              </div>
              <div className="flex flex-shrink-0 items-center gap-4 text-right">
                <span className="text-destructive tabular-nums">
                  {formatPercent(card.utilization)}
                </span>
                <span className="hidden text-muted-foreground tabular-nums sm:inline">
                  {formatMinor(card.finance.balanceMinor)} balance
                </span>
                {card.finance.promo && (
                  <span className="hidden text-xs text-muted-foreground md:inline">
                    0% ends {formatShortDate(card.finance.promo.endsOn)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 border-t pt-4">
          <WhatIfSlider cards={dtos} />
        </div>
      </CardContent>
    </Card>
  )
}
