"use client"

/**
 * Discovered-cards review flow (issue #109) — the Connected-banks tab of
 * /cards/import. Candidates are credit-subtype accounts from the user's
 * linked institutions that are not yet cards (PlaidAccount.creditCardId
 * null). Select → confirm creates the cards SYNC_PENDING, then Liabilities
 * fills APR/minimum/due-day server-side. Server-confirmed useActionState, no
 * optimistic updates (monetary-mutation policy); restart remounts via
 * generation key. Post-review pass: live selection count, select-all,
 * stacked balances below md (no decision-critical data behind the scroll),
 * focused + announced completion, sibling banner recipes.
 */
import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CreditCard, Landmark, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatMinor } from "@/lib/formatting"
import {
  importDiscoveredCards,
  type ImportDiscoveredState,
} from "@/features/cards/actions/plaid-cards"
import type { DiscoveredCardDTO } from "@/features/cards/server/plaid-cards-service"

const IDLE: ImportDiscoveredState = { status: "idle" }

const CHECKBOX_CLASS =
  "h-4 w-4 rounded-sm accent-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export function ImportPlaidCards({ candidates }: { candidates: DiscoveredCardDTO[] }) {
  const [generation, setGeneration] = useState(0)
  return (
    <ImportPlaidCardsInner
      key={generation}
      candidates={candidates}
      onRestart={() => setGeneration((g) => g + 1)}
    />
  )
}

function ImportPlaidCardsInner({
  candidates,
  onRestart,
}: {
  candidates: DiscoveredCardDTO[]
  onRestart: () => void
}) {
  const [state, formAction, pending] = useActionState(importDiscoveredCards, IDLE)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.plaidAccountId))
  )
  const errorRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus()
    if (state.status === "done") doneRef.current?.focus()
  }, [state])

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.size > 0 && selected.size < candidates.length
    }
  }, [selected, candidates.length])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (state.status === "done") {
    const { created, skipped, liabilities } = state.result
    return (
      <Card>
        <CardContent role="status" className="flex flex-col items-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CreditCard className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <h2 ref={doneRef} tabIndex={-1} className="mt-4 font-heading text-xl font-semibold outline-none">
            {created.length === 1
              ? "1 card imported"
              : `${created.length} cards imported`}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {liabilities.cardsUpdated > 0
              ? `APR, minimum payment, and due dates were filled from your bank for ${liabilities.cardsUpdated} card${liabilities.cardsUpdated === 1 ? "" : "s"}.`
              : "Bank-provided details will fill on the next sync."}
            {liabilities.suggestionsOpened > 0 &&
              ` ${liabilities.suggestionsOpened} value${liabilities.suggestionsOpened === 1 ? "" : "s"} differ from your entries — review them on Cards.`}
          </p>
          {(skipped > 0 || liabilities.failedItems > 0) && (
            <p className="mt-3 flex max-w-md items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-left text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {skipped > 0 && `${skipped} account${skipped === 1 ? "" : "s"} had already been imported. `}
                {liabilities.failedItems > 0 && (
                  <>
                    Some bank details could not be fetched — those cards are flagged under{" "}
                    <Link href="/overview" className="underline underline-offset-2">
                      Needs Attention
                    </Link>{" "}
                    on your Overview.
                  </>
                )}
              </span>
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/cards">View cards</Link>
            </Button>
            <Button variant="outline" onClick={onRestart}>
              Back to Connected banks
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Landmark className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
          <h2 className="mt-4 font-heading text-xl font-semibold">No cards to discover</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Credit cards found at your connected institutions appear here for
            review. Connect a bank from Settings, or sync an existing
            connection, and check back.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/settings">Manage connections</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="sr-only" role="status">
        {pending
          ? "Importing selected cards…"
          : `${selected.size} of ${candidates.length} accounts selected`}
      </p>
      {state.status === "error" && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          data-testid="import-error"
          className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-error-text outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.message}
        </div>
      )}
      <Card className="overflow-hidden py-0">
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Discovered credit accounts"
        >
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={selected.size === candidates.length}
                    disabled={pending}
                    onChange={() =>
                      setSelected(
                        selected.size === candidates.length
                          ? new Set()
                          : new Set(candidates.map((c) => c.plaidAccountId))
                      )
                    }
                    aria-label="Select all accounts"
                    className={CHECKBOX_CLASS}
                  />
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Account
                </th>
                <th scope="col" className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                  Institution
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {candidates.map((c) => (
                <tr key={c.plaidAccountId}>
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      name="accountId"
                      value={c.plaidAccountId}
                      checked={selected.has(c.plaidAccountId)}
                      onChange={() => toggle(c.plaidAccountId)}
                      disabled={pending}
                      aria-label={`Import ${c.name}${c.maskLabel ? ` ${c.maskLabel}` : ""} at ${c.institutionName}`}
                      className={CHECKBOX_CLASS}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{c.name}</span>
                    {c.maskLabel && (
                      <span className="ml-2 text-muted-foreground">{c.maskLabel}</span>
                    )}
                    {/* Below md the institution + balance stack here so the
                        decision-critical figures never hide behind a scroll. */}
                    <span className="mt-0.5 block text-muted-foreground md:hidden">
                      {c.institutionName} ·{" "}
                      <span className="tabular-nums text-foreground">
                        {formatMinor(c.balanceCents)}
                      </span>
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {c.institutionName}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                    {formatMinor(c.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          Imported cards start shared — set an owner from each card&apos;s edit
          sheet. APR, minimum, and due dates fill automatically where your bank
          provides them. Unchecked accounts stay here for later.
        </p>
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {pending
            ? "Importing…"
            : `Import ${selected.size} selected`}
        </Button>
      </div>
    </form>
  )
}
