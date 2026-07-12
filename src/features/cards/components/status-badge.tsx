/**
 * The single STATUS badge every card surface renders (cards table + overview
 * card rack). `status` is the already-resolved value from the one status
 * engine (resolveStatusBadge) — never re-derived here (EDR-003). Lifted out
 * of cards-table.tsx (issue #12) so the table and rack render it identically.
 */
import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "HIGH_UTILIZATION":
      return <Badge variant="destructive">High Utilization</Badge>
    case "PROMO_EXPIRED":
      return (
        <Badge variant="outline" className="border-destructive/50 text-destructive">
          0% Expired
        </Badge>
      )
    case "PROMO_ENDING_SOON":
      return (
        <Badge
          variant="outline"
          className="border-warning/50 bg-warning/10 text-warning"
        >
          0% Ending Soon
        </Badge>
      )
    case "DUE_SOON":
      return (
        <Badge
          variant="outline"
          className="border-warning/50 bg-warning/10 text-warning"
        >
          Due Soon
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
