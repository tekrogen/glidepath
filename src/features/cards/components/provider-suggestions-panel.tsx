"use client"

/**
 * Provider-suggestion review panel (issue #109) — renders on /cards when a
 * bank-reported value diverges from a user-entered field. Blueprint copy
 * verbatim per row: "Plaid reports APR 24.99% — you recorded 25.5%".
 * Accepting applies the value and flips provenance to PLAID; dismissing pins
 * the user's value against that proposal. Server-confirmed actions, no
 * optimistic updates. Post-review pass: the two comparison values carry
 * foreground emphasis (the delta IS the decision), resolutions toast +
 * refocus the panel heading, warning iconography follows the banner recipe.
 */
import { useActionState, useEffect, useRef } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

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

function formatValue(field: SuggestionDTO["field"], value: string): string {
  switch (field) {
    case "REGULAR_APR_BPS":
      return formatAprBps(Number(value))
    case "PAYMENT_DUE_DAY":
      return `day ${value}`
    default:
      return formatMinor(Number(value))
  }
}

const Value = ({ children }: { children: React.ReactNode }) => (
  <span className="font-medium tabular-nums text-foreground">{children}</span>
)

function SuggestionRow({
  suggestion,
  onResolved,
}: {
  suggestion: SuggestionDTO
  onResolved: (message: string) => void
}) {
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

  const label = FIELD_LABELS[suggestion.field]
  const proposed = formatValue(suggestion.field, suggestion.proposedValue)

  useEffect(() => {
    if (acceptState.status === "done") {
      onResolved(`${suggestion.cardName}: ${label} updated to ${proposed}.`)
    }
  }, [acceptState.status, onResolved, suggestion.cardName, label, proposed])
  useEffect(() => {
    if (dismissState.status === "done") {
      onResolved(`${suggestion.cardName}: kept your ${label}.`)
    }
  }, [dismissState.status, onResolved, suggestion.cardName, label])

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <span className="font-medium">{suggestion.cardName}</span>
        <span className="text-muted-foreground">
          {" — Plaid reports "}
          {label} <Value>{proposed}</Value>
          {suggestion.currentValue === null ? (
            <> — you haven&apos;t recorded one</>
          ) : (
            <>
              {" — you recorded "}
              <Value>{formatValue(suggestion.field, suggestion.currentValue)}</Value>
            </>
          )}
        </span>
        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="mt-1 text-sm text-error-text outline-none">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <Button
            type="submit"
            size="sm"
            disabled={pending}
            aria-label={`Accept ${label} ${proposed} for ${suggestion.cardName}`}
          >
            {acceptPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
            {acceptPending ? "Applying…" : "Accept"}
          </Button>
        </form>
        <form action={dismissAction}>
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={pending}
            aria-label={`Keep your ${label} on ${suggestion.cardName}`}
          >
            {dismissPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
            {dismissPending ? "Dismissing…" : "Keep mine"}
          </Button>
        </form>
      </div>
    </li>
  )
}

export function ProviderSuggestionsPanel({ suggestions }: { suggestions: SuggestionDTO[] }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  if (suggestions.length === 0) return null

  const handleResolved = (message: string) => {
    toast.success(message)
    headingRef.current?.focus()
  }

  return (
    <Card data-testid="provider-suggestions">
      <CardContent className="py-4">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
          </span>
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="font-heading text-base font-semibold outline-none">
              Your bank reports values that differ from yours
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accept to use the bank&apos;s value from now on, or keep yours —
              nothing changes without your say.
            </p>
          </div>
        </div>
        <ul className="mt-2 divide-y">
          {suggestions.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} onResolved={handleResolved} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
