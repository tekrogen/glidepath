"use client"

/**
 * Discovered-cards review flow (issue #109) — the Plaid tab of /cards/import.
 * Candidates are credit-subtype accounts from the user's linked institutions
 * that are not yet cards (PlaidAccount.creditCardId null). Select → confirm
 * creates the cards SYNC_PENDING, then Liabilities fills APR/minimum/due-day
 * server-side. Server-confirmed useActionState, no optimistic updates
 * (monetary-mutation policy); restart remounts via generation key.
 */
import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CreditCard, Landmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatMinor } from "@/lib/formatting"
import {
  importDiscoveredCards,
  type ImportDiscoveredState,
} from "@/features/cards/actions/plaid-cards"
import type { DiscoveredCardDTO } from "@/features/cards/server/plaid-cards-service"

const IDLE: ImportDiscoveredState = { status: "idle" }

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
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus()
  }, [state])

  if (state.status === "done") {
    const { created, skipped, liabilities } = state.result
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-4 font-heading text-xl font-semibold">
            {created.length === 1
              ? "1 card imported"
              : `${created.length} cards imported`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {liabilities.cardsUpdated > 0
              ? `APR, minimum payment, and due dates were filled from your issuer for ${liabilities.cardsUpdated} card${liabilities.cardsUpdated === 1 ? "" : "s"}.`
              : "Issuer details will fill on the next sync."}
            {liabilities.suggestionsOpened > 0 &&
              ` ${liabilities.suggestionsOpened} value${liabilities.suggestionsOpened === 1 ? "" : "s"} differ from your entries — review them on Cards.`}
          </p>
          {(skipped > 0 || liabilities.failedItems > 0) && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {skipped > 0 && `${skipped} account${skipped === 1 ? "" : "s"} already imported. `}
              {liabilities.failedItems > 0 &&
                "Some issuer details could not be fetched — those cards show a sync alert."}
            </p>
          )}
          <div className="mt-6 flex gap-3">
            <Button asChild>
              <Link href="/cards">View cards</Link>
            </Button>
            <Button variant="outline" onClick={onRestart}>
              Back to discovery
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
            <Landmark className="h-6 w-6 text-muted-foreground" />
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
        {pending ? "Importing selected cards…" : ""}
      </p>
      {state.status === "error" && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-error-text"
        >
          {state.message}
        </div>
      )}
      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="w-10 px-4 py-3" aria-label="Import selection" />
                <th className="px-2 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Account
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Institution
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {candidates.map((c) => (
                <tr key={c.plaidAccountId}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="accountId"
                      value={c.plaidAccountId}
                      defaultChecked
                      disabled={pending}
                      aria-label={`Import ${c.name}${c.maskLabel ? ` ${c.maskLabel}` : ""}`}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <span className="font-medium">{c.name}</span>
                    {c.maskLabel && (
                      <span className="ml-2 text-muted-foreground">{c.maskLabel}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">{c.institutionName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMinor(c.balanceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Imported cards start shared — set an owner from each card&apos;s edit
          sheet. Issuer APR, minimum, and due dates fill automatically where
          your bank provides them.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import selected"}
        </Button>
      </div>
    </form>
  )
}
