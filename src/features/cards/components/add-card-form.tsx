"use client"

/**
 * Manual add-card form (issue #26, EDR-005 manual-first). Fields render
 * through the shared CardFormFields (issue #47 — one field set for add and
 * edit); submission is server-confirmed via useActionState — pending UI
 * only, no optimistic update (monetary-mutation policy).
 *
 * React 19 resets uncontrolled inputs after the action settles, so every
 * input re-seeds from state.values (the raw strings the action echoes on
 * failure) via defaultValue; the controlled Switch keeps its own state.
 */
import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createCard, type CreateCardState } from "@/features/cards/actions/create-card"
import {
  CardFormFields,
  type HouseholdMemberOption,
} from "@/features/cards/components/card-form-fields"

const initialState: CreateCardState = { success: false, message: "" }

export function AddCardForm({
  onDone,
  onPendingChange,
  members,
}: {
  onDone: () => void
  onPendingChange: (pending: boolean) => void
  members: HouseholdMemberOption[]
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createCard, initialState)
  const [hasPromo, setHasPromo] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  // The sheet must not be dismissable while a monetary mutation is in
  // flight — report pending upward so it can ignore close requests.
  useEffect(() => {
    onPendingChange(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identity is stable enough per render
  }, [pending])

  // Server-confirmed outcome: toast + close on success, focus the error
  // banner on failure so failed submits are perceivable.
  useEffect(() => {
    if (state.success) {
      toast.success(state.message)
      onDone()
      router.refresh()
    } else if (state.message) {
      errorRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run per action result only
  }, [state])

  return (
    <form action={formAction} className="space-y-6" noValidate aria-busy={pending}>
      <p role="status" className="sr-only">
        {pending ? "Adding card…" : ""}
      </p>

      {!state.success && state.message && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-error-text focus:outline-none focus:ring-2 focus:ring-destructive/40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.message}
        </div>
      )}

      <CardFormFields
        errors={state.fieldErrors}
        values={state.values}
        hasPromo={hasPromo}
        onHasPromoChange={setHasPromo}
        members={members}
      />

      {/* Actions — server-confirmed pending state, no optimistic update */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add card
        </Button>
      </div>
    </form>
  )
}
