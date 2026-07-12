/**
 * Overview total-balance header (issue #12, 0b wireframe) — replaces the plain
 * page header. Eyebrow + hero total balance (the page's <h1>, kept in Syne even
 * though the mockup used h3) on the left; a utilization chip + mini bar on the
 * right. Pure presentation: figures arrive precomputed from lib/finance and the
 * chip classification comes from utilizationStatus (threshold stays in finance,
 * never a raw compare here — EDR-019).
 */
import { utilizationStatus } from "@/lib/finance"
import type { PortfolioSummary } from "@/lib/finance"
import { formatMinor, formatPercent } from "@/lib/formatting"

export function OverviewHeader({ summary }: { summary: PortfolioSummary }) {
  const util = summary.overallUtilization
  const status = utilizationStatus(util)
  const high = status === "high"

  const chipTone =
    status === "high"
      ? "border-destructive/50 text-destructive"
      : status === "ok"
        ? "border-success/40 text-success"
        : "border-border text-muted-foreground"
  const chipLabel =
    util == null ? "—" : `${formatPercent(util)} · ${high ? "HIGH" : "OK"}`

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Total balance · {summary.cardCount} {summary.cardCount === 1 ? "card" : "cards"}
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight tabular-nums">
          {formatMinor(summary.totalBalanceMinor)}
        </h1>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Utilization
        </span>
        <div className="flex items-center gap-3">
          <span className="h-2 w-32 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span
              className={`block h-full rounded-full ${high ? "bg-destructive" : "bg-success"}`}
              style={{ width: `${util == null ? 0 : Math.min(100, util * 100)}%` }}
            />
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${chipTone}`}
          >
            {chipLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
