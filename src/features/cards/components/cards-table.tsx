"use client"

/**
 * Cards portfolio table. Layout per the mockup / wireframe 2d; styling per
 * Ebia's credit-cards-table (sortable headers, urgency badge tiers,
 * tabular-nums). Status badges come precomputed from the canonical engine
 * (never re-derived here — EDR-003).
 */
import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { resolveStatusBadge, type Alert, type Lifecycle } from "@/features/cards"
import { FreezeControl } from "@/features/cards/components/freeze-control"
import { StatusBadge } from "@/features/cards/components/status-badge"
import { formatMinor, formatPercent } from "@/lib/formatting"

export interface CardsTableRow {
  id: string
  cardName: string
  lastFour: string | null
  issuerKey: string | null
  issuer: string
  ownerLabel: string | null
  /** Lifecycle + alert are carried raw so the displayed badge derives through
   *  the one status engine (resolveStatusBadge) — this is what makes the
   *  optimistic freeze AND unfreeze correct (EDR-003). */
  lifecycle: Lifecycle
  alert: Alert
  /** Days until the next payment due date; drives the freeze-confirm warning. */
  dueInDays: number | null
  utilization: number | null
  balanceCents: number
  limitCents: number | null
  availableCents: number | null
  /** Preformatted APR cell: "22.74%" or "0% · 421d" (promo). */
  aprDisplay: string
  aprIsPromo: boolean
  dueDay: number | null
  minPayCents: number | null
  hasEstimatedInputs: boolean
}

type SortKey =
  | "cardName"
  | "limitCents"
  | "balanceCents"
  | "availableCents"
  | "utilization"
  | "dueDay"
  | "minPayCents"

const PAGE_SIZE = 10

const SWATCHES: Record<string, string> = {
  chase: "from-sky-700 to-cyan-500",
  citi: "from-indigo-700 to-sky-500",
  usbank: "from-teal-700 to-emerald-500",
  usaa: "from-rose-700 to-orange-500",
  wellsfargo: "from-amber-700 to-yellow-500",
  capitalone: "from-emerald-700 to-teal-400",
  apple: "from-zinc-600 to-zinc-400",
  ally: "from-purple-700 to-fuchsia-500",
}

function SortHeader({
  label,
  columnKey,
  align = "right",
  sortKey,
  sortDesc,
  onToggle,
}: {
  label: string
  columnKey: SortKey
  align?: "left" | "right"
  sortKey: SortKey
  sortDesc: boolean
  onToggle: (key: SortKey) => void
}) {
  const active = sortKey === columnKey
  const Icon = active ? (sortDesc ? ArrowDown : ArrowUp) : ArrowUpDown
  return (
    <th
      className={`px-4 py-3 ${align === "left" ? "text-left" : "text-right"}`}
      aria-sort={active ? (sortDesc ? "descending" : "ascending") : undefined}
    >
      <button
        onClick={() => onToggle(columnKey)}
        className={`inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase ${
          active ? "text-foreground" : "text-muted-foreground"
        } hover:text-foreground`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  )
}

export function CardsTable({ rows }: { rows: CardsTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("utilization")
  const [sortDesc, setSortDesc] = useState(true)
  const [page, setPage] = useState(0)

  // Optimistic lifecycle per card id. A fresh `rows` prop means the RSC
  // refetched (router.refresh / navigation) and server truth now reflects
  // the mutation, so overrides are dropped and the derived badge reads from
  // server data — no flash, since truth already matches the override. Reset
  // during render (React's documented prop-change adjustment) rather than in
  // an effect, so the stale override never paints for a frame.
  const [lifecycleOverrides, setLifecycleOverrides] = useState<Record<string, Lifecycle>>({})
  const [prevRows, setPrevRows] = useState(rows)
  if (rows !== prevRows) {
    setPrevRows(rows)
    setLifecycleOverrides({})
  }
  const setOverride = (id: string, next: Lifecycle) =>
    setLifecycleOverrides((o) => ({ ...o, [id]: next }))

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1 // unknowns sink regardless of direction
      if (bv == null) return -1
      const cmp =
        typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)
      return sortDesc ? -cmp : cmp
    })
    return copy
  }, [rows, sortKey, sortDesc])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const paged = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d)
    } else {
      setSortKey(key)
      setSortDesc(key !== "cardName")
    }
    setPage(0)
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <SortHeader label="Card" columnKey="cardName" align="left" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <SortHeader label="Limit" columnKey="limitCents" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <SortHeader label="Balance" columnKey="balanceCents" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <SortHeader label="Available" columnKey="availableCents" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <SortHeader label="Utilization" columnKey="utilization" align="left" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wide uppercase text-muted-foreground">
                APR
              </th>
              <SortHeader label="Due" columnKey="dueDay" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <SortHeader label="Min Pay" columnKey="minPayCents" sortKey={sortKey} sortDesc={sortDesc} onToggle={toggleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No cards match.
                </td>
              </tr>
            )}
            {paged.map((r) => {
              const high = r.utilization != null && r.utilization >= 0.3
              const effectiveLifecycle = lifecycleOverrides[r.id] ?? r.lifecycle
              return (
                <tr key={r.id} className="hover:bg-muted/50" data-testid="card-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-6 w-9 shrink-0 rounded bg-gradient-to-br ${
                          SWATCHES[r.issuerKey ?? ""] ?? "from-slate-600 to-slate-400"
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{r.cardName}</span>
                          {r.ownerLabel && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {r.ownerLabel}
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.issuer} ····{r.lastFour ?? "————"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.limitCents == null ? "—" : formatMinor(r.limitCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatMinor(r.balanceCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {r.availableCents == null ? "—" : formatMinor(r.availableCents)}
                  </td>
                  <td className="px-4 py-3">
                    {r.utilization == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className={`block h-full rounded-full ${high ? "bg-destructive" : "bg-success"}`}
                            style={{ width: `${Math.min(100, r.utilization * 100)}%` }}
                          />
                        </span>
                        <span className={`tabular-nums ${high ? "text-destructive" : ""}`}>
                          {formatPercent(r.utilization)}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.aprIsPromo ? (
                      <span className="text-secondary">{r.aprDisplay}</span>
                    ) : (
                      <span className={r.aprDisplay === "—" ? "text-muted-foreground" : ""}>
                        {r.aprDisplay}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.dueDay ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.minPayCents == null ? "—" : formatMinor(r.minPayCents)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={resolveStatusBadge(effectiveLifecycle, r.alert)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FreezeControl
                      cardId={r.id}
                      cardName={r.cardName}
                      lastFour={r.lastFour}
                      lifecycle={r.lifecycle}
                      dueInDays={r.dueInDays}
                      minPayCents={r.minPayCents}
                      hasEstimatedInputs={r.hasEstimatedInputs}
                      onLifecycleChange={(next) => setOverride(r.id, next)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
        <span>
          {sorted.length === 0
            ? "No cards"
            : `Showing ${currentPage * PAGE_SIZE + 1}–${Math.min(
                (currentPage + 1) * PAGE_SIZE,
                sorted.length
              )} of ${sorted.length} active cards`}
        </span>
        <span className="flex items-center gap-2">
          <button
            className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
            disabled={currentPage <= 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            className="rounded-md border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </span>
      </div>
    </Card>
  )
}
