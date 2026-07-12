"use client"

/**
 * Manual add-card form (issue #26, EDR-005 manual-first). Field grouping
 * and micro-copy follow the Ebia donor idiom re-expressed in this app's
 * tokens; submission is server-confirmed via useActionState — pending UI
 * only, no optimistic update (monetary-mutation policy).
 */
import { useActionState, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createCard, type CreateCardState } from "@/features/cards/actions/create-card"

const initialState: CreateCardState = { success: false, message: "" }

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p id={id} className="text-xs text-destructive">
      {errors[0]}
    </p>
  )
}

export function AddCardForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(createCard, initialState)
  const [hasPromo, setHasPromo] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

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

  const errors = state.fieldErrors

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {!state.success && state.message && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.message}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Fields marked * are required</p>

      {/* Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cardName">Card name *</Label>
          <Input
            id="cardName"
            name="cardName"
            required
            placeholder="e.g. Quicksilver (Marti)"
            aria-describedby="cardName-error"
          />
          <FieldError id="cardName-error" errors={errors?.cardName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issuer">Issuer *</Label>
          <Input
            id="issuer"
            name="issuer"
            required
            placeholder="e.g. Capital One"
            aria-describedby="issuer-error"
          />
          <FieldError id="issuer-error" errors={errors?.issuer} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastFour">Last 4 digits</Label>
          <Input
            id="lastFour"
            name="lastFour"
            inputMode="numeric"
            maxLength={4}
            placeholder="0042"
            aria-describedby="lastFour-error"
          />
          <p className="text-xs text-muted-foreground">
            Only the last 4 — never the full card number
          </p>
          <FieldError id="lastFour-error" errors={errors?.lastFour} />
        </div>
      </div>

      {/* Limits & balance */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="creditLimit">Credit limit ($)</Label>
          <Input
            id="creditLimit"
            name="creditLimit"
            inputMode="decimal"
            placeholder="9750.00"
            aria-describedby="creditLimit-error"
          />
          <FieldError id="creditLimit-error" errors={errors?.creditLimit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentBalance">Current balance ($)</Label>
          <Input
            id="currentBalance"
            name="currentBalance"
            inputMode="decimal"
            placeholder="0.00"
            aria-describedby="currentBalance-error"
          />
          <FieldError id="currentBalance-error" errors={errors?.currentBalance} />
        </div>
      </div>

      {/* Promo */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="hasPromo">0% intro APR active</Label>
            <p className="text-xs text-muted-foreground">
              Track when a promotional 0% APR period ends
            </p>
          </div>
          <Switch id="hasPromo" name="hasPromo" checked={hasPromo} onCheckedChange={setHasPromo} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {hasPromo && (
            <div className="space-y-2">
              <Label htmlFor="promoEndsOn">0% APR end date</Label>
              <Input id="promoEndsOn" name="promoEndsOn" type="date" aria-describedby="promoEndsOn-error" />
              <FieldError id="promoEndsOn-error" errors={errors?.promoEndsOn} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="regularApr">Regular APR (%){hasPromo && " after promo"}</Label>
            <Input
              id="regularApr"
              name="regularApr"
              inputMode="decimal"
              placeholder="22.74"
              aria-describedby="regularApr-error"
            />
            <FieldError id="regularApr-error" errors={errors?.regularApr} />
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paymentDueDay">Payment due day (1–31)</Label>
          <Input
            id="paymentDueDay"
            name="paymentDueDay"
            inputMode="numeric"
            placeholder="19"
            aria-describedby="paymentDueDay-error"
          />
          <FieldError id="paymentDueDay-error" errors={errors?.paymentDueDay} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="statementCloseDay">Statement close day (1–31)</Label>
          <Input
            id="statementCloseDay"
            name="statementCloseDay"
            inputMode="numeric"
            placeholder="24"
            aria-describedby="statementCloseDay-error"
          />
          <FieldError id="statementCloseDay-error" errors={errors?.statementCloseDay} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minimumPayment">Minimum payment ($)</Label>
          <Input
            id="minimumPayment"
            name="minimumPayment"
            inputMode="decimal"
            placeholder="68.00"
            aria-describedby="minimumPayment-error"
          />
          <p className="text-xs text-muted-foreground">Required minimum from your statement</p>
          <FieldError id="minimumPayment-error" errors={errors?.minimumPayment} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentNote">Payment note</Label>
          <Input
            id="paymentNote"
            name="paymentNote"
            placeholder='e.g. "$350/month" or "Statement Amt"'
            aria-describedby="paymentNote-error"
          />
          <p className="text-xs text-muted-foreground">What you intend to pay each month</p>
          <FieldError id="paymentNote-error" errors={errors?.paymentNote} />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Pay-down notes, bonus deadlines, …"
          aria-describedby="notes-error"
        />
        <FieldError id="notes-error" errors={errors?.notes} />
      </div>

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
