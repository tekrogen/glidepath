"use client"

/**
 * Edit-card form (issue #47) — the add-card idiom applied to update:
 * shared CardFormFields seeded with the card's current values, server-
 * confirmed save via useActionState, pending-guarded sheet. The footer
 * carries the mockup's red "Delete card" (left) — explicit audited
 * removal (issue #57's delete half): the AlertDialog lists exactly the
 * Restrict-linked rows that go with the card before anything runs
 * (Marti's 2026-07-25 policy choice; recorded deviation from the
 * blueprint's archive-first model).
 */
import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { deleteCard } from "@/features/cards/actions/delete-card"
import {
  getCardDependents,
  type CardDependents,
} from "@/features/cards/actions/get-card-dependents"
import { editCard, type EditCardState } from "@/features/cards/actions/edit-card"
import {
  CardFormFields,
  type HouseholdMemberOption,
} from "@/features/cards/components/card-form-fields"
import { dependentsSummary } from "@/features/cards/utils/dependents-summary"

const initialState: EditCardState = { success: false, message: "" }

export interface EditCardSeed {
  cardId: string
  cardName: string
  hasPromo: boolean
  /** Current values as form strings — CardFormFields defaultValue seeds. */
  values: Record<string, string>
  /** Restrict-FK dependents the delete confirm must list (issue #57). */
  scheduledPaymentCount: number
  statementCount: number
  hasAutopayLink: boolean
}

export function EditCardForm({
  seed,
  members,
  onDone,
  onPendingChange,
}: {
  seed: EditCardSeed
  members: HouseholdMemberOption[]
  onDone: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(editCard, initialState)
  const [hasPromo, setHasPromo] = useState(seed.hasPromo)
  const [deleting, startDelete] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Fresh dependents, read when the confirm opens (review finding: the
  // page-load seed counts can be stale by delete time). Seed is the
  // fallback while the read is in flight.
  const [freshDeps, setFreshDeps] = useState<CardDependents | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const busy = pending || deleting

  useEffect(() => {
    onPendingChange(busy)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callback identity is stable enough per render
  }, [busy])

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

  const handleConfirmOpenChange = (open: boolean) => {
    setConfirmOpen(open)
    if (open) {
      setFreshDeps(null)
      void getCardDependents(seed.cardId).then((deps) => {
        if (deps) setFreshDeps(deps)
      })
    }
  }

  const handleDelete = () => {
    // Double-activation guard (review finding): the second click of a
    // double-tap must be a no-op, never a false "could not delete" toast.
    if (deleting) return
    startDelete(async () => {
      const res = await deleteCard(seed.cardId)
      if (!res.success) {
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      onDone()
      router.refresh()
    })
  }

  const dependents = dependentsSummary(
    freshDeps
      ? {
          scheduledPaymentCount: freshDeps.scheduledPayments,
          statementCount: freshDeps.statements,
          hasAutopayLink: freshDeps.autopayLink,
        }
      : seed
  )

  return (
    <form action={formAction} className="space-y-6" noValidate aria-busy={busy}>
      <input type="hidden" name="cardId" value={seed.cardId} />
      {/* Compare-and-swap version: the row's updatedAt at seed time. */}
      <input type="hidden" name="expectedUpdatedAt" value={seed.values.expectedUpdatedAt} />
      <p role="status" className="sr-only">
        {pending ? "Saving card…" : deleting ? "Deleting card…" : ""}
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
        seed={seed.values}
        hasPromo={hasPromo}
        onHasPromoChange={setHasPromo}
        members={members}
      />

      {/* Footer per the card-management mockup: destructive Delete left,
          Cancel · Save right. Delete is confirm-gated and lists dependents.
          flex-wrap (design QA DS-47-005): the three buttons sit at zero
          slack at 390 — the pending spinner must wrap, never overflow. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <AlertDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              data-testid="delete-card"
              className="text-error-text hover:bg-destructive/10 hover:text-error-text"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete card
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {seed.cardName}?</AlertDialogTitle>
              <AlertDialogDescription>
                {dependents
                  ? `This permanently removes the card AND ${dependents} — payment history included. `
                  : "This permanently removes the card. "}
                There is no undo. Nothing is sent to your bank — this only deletes the app&apos;s
                records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep card</AlertDialogCancel>
              {/* Destructive-of-history action must NOT wear the constructive
                  primary (design QA DS-47-001). error-text is the AA-safe red
                  fill in both modes (7.46:1 light / ~7.9:1 dark with
                  background-colored text); bg-destructive + white fails light
                  AA at 3.61:1 — measured, do not "simplify" back. */}
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                data-testid="delete-card-confirm"
                className="bg-error-text text-background hover:bg-error-text/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy} data-testid="save-card">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
    </form>
  )
}
