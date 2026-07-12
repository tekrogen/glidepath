/**
 * The single STATUS badge every card surface renders (cards table + overview
 * card rack). `status` is the already-resolved value from the one status
 * engine (resolveStatusBadge) — never re-derived here (EDR-003). Lifted out
 * of cards-table.tsx (issue #12) so the table and rack render it identically.
 *
 * `compact` swaps only the DISPLAYED label for a shorter one (same derivation,
 * same tone) so the space-tight card-rack tile doesn't crowd out the card name
 * at 2-col widths (design QA). The cards table keeps the full labels.
 */
import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  switch (status) {
    case "HIGH_UTILIZATION":
      return <Badge variant="destructive">{compact ? "High" : "High Utilization"}</Badge>
    case "PROMO_EXPIRED":
      return (
        <Badge variant="outline" className="border-destructive/50 text-destructive">
          {compact ? "0% expired" : "0% Expired"}
        </Badge>
      )
    case "PROMO_ENDING_SOON":
      return (
        <Badge
          variant="outline"
          className="border-warning/50 bg-warning/10 text-warning"
        >
          {compact ? "0% ending" : "0% Ending Soon"}
        </Badge>
      )
    case "DUE_SOON":
      return (
        <Badge
          variant="outline"
          className="border-warning/50 bg-warning/10 text-warning"
        >
          {compact ? "Due" : "Due Soon"}
        </Badge>
      )
    case "FROZEN":
      return (
        <Badge variant="outline" className="border-secondary/50 text-secondary">
          Frozen
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-success/40 text-success">
          OK
        </Badge>
      )
  }
}
