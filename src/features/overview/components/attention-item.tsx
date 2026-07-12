/**
 * One attention feed row — pure presentation (issue #25). Danger accent for
 * PROMO_EXPIRED / HIGH_UTILIZATION, muted accent for the rest; every figure
 * arrives pre-formatted in the item's body string.
 */
import Link from "next/link"

import type { AttentionItem } from "../utils/build-attention-items"

const DANGER_TYPES: ReadonlySet<AttentionItem["type"]> = new Set(["PROMO_EXPIRED", "HIGH_UTILIZATION"])

export function AttentionItemRow({ item }: { item: AttentionItem }) {
  const danger = DANGER_TYPES.has(item.type)
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0" data-testid="attention-item">
      <span
        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${danger ? "bg-destructive" : "bg-primary/60"}`}
        aria-hidden
      />
      <div className="min-w-0">
        <Link
          href={item.href}
          className={`text-sm font-medium hover:underline ${danger ? "text-destructive" : ""}`}
        >
          {item.title}
        </Link>
        <p className="text-xs text-muted-foreground">{item.body}</p>
      </div>
    </li>
  )
}
