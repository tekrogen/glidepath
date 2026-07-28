"use client"

/**
 * Provider-suggestion review panel (issue #109) — renders on /cards when a
 * Plaid value diverges from a user-entered field. Blueprint copy verbatim:
 * "Plaid reports APR 24.99% — you recorded 25.5%". Accepting applies the
 * value and flips provenance to PLAID; dismissing pins the user's value
 * against that proposal. Server-confirmed actions, no optimistic updates.
 */
import { useActionState, useEffect, useRef } from "react"
import { Landmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatAprBps, formatMinor } from "@/lib/formatting"
import {
  acceptSuggestion,
  dismissSuggestion,
  type ResolveSuggestionState,
} from "@/features/cards/actions/plaid-cards"
import type { SuggestionDTO } from "@/features/cards/server/plaid-cards-service"

const IDLE: ResolveSuggestionState = { status: "idle" }

const FIELD_LABELS: Record<SuggestionDTO["field"], string> = {
  REGULAR_APR_BPS: "APR",
  CREDIT_LIMIT_MINOR: "credit limit",
  MINIMUM_PAYMENT_MINOR: "minimum payment",
  PAYMENT_DUE_DAY: "payment due",
}

function formatValue(field: SuggestionDTO["field"], value: string | null): string {
  if (value === null) return "nothing"
  switch (field) {
    case "REGULAR_APR_BPS":
      return formatAprBps(Number(value))
    case "PAYMENT_DUE_DAY":
      return `day ${value}`
    default:
      return formatMinor(Number(value))
  }
}

function SuggestionRow({ suggestion }: { suggestion: SuggestionDTO }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptSuggestion, IDLE)
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissSuggestion, IDLE)
  const pending = acceptPending || dismissPending
  const error =
    acceptState.status === "error"
      ? acceptState.message
      : dismissState.status === "error"
        ? dismissState.message
        : null
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <span className="font-medium">{suggestion.cardName}</span>
        <span className="text-muted-foreground">
          {" — Plaid reports "}
          {FIELD_LABELS[suggestion.field]} {formatValue(suggestion.field, suggestion.proposedValue)}
          {" — you recorded "}
          {formatValue(suggestion.field, suggestion.currentValue)}
        </span>
        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="mt-1 text-sm text-error-text">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <Button type="submit" size="sm" disabled={pending}>
            {acceptPending ? "Applying…" : "Accept"}
          </Button>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {dismissPending ? "Dismissing…" : "Keep mine"}
          </Button>
        </form>
      </div>
    </li>
  )
}

export function ProviderSuggestionsPanel({ suggestions }: { suggestions: SuggestionDTO[] }) {
  if (suggestions.length === 0) return null
  return (
    <Card data-testid="provider-suggestions">
      <CardContent className="py-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-warning" aria-hidden />
          <h2 className="font-heading text-base font-semibold">
            Provider values differ from your entries
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Accept to use the provider&apos;s value from now on, or keep yours —
          nothing changes without your say.
        </p>
        <ul className="mt-2 divide-y">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
