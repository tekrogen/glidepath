"use client"

/**
 * Manual add-card form (issue #26, EDR-005 manual-first). Field grouping
 * and micro-copy follow the Ebia donor idiom re-expressed in this app's
 * tokens; submission is server-confirmed via useActionState — pending UI
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createCard, type CreateCardState } from "@/features/cards/actions/create-card"

const initialState: CreateCardState = { success: false, message: "" }

/** Join the ids that actually exist in the DOM right now. */
function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(" ")
  return joined || undefined
}

/** Error border for fields the banner promises are "highlighted". */
function invalidClass(errors?: string[]): string | undefined {
  return errors?.length ? "border-destructive" : undefined
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p id={id} className="text-xs text-destructive">
      {errors[0]}
    </p>
  )
}

export function AddCardForm({
  onDone,
  onPendingChange,
}: {
  onDone: () => void
  onPendingChange: (pending: boolean) => void
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

  const errors = state.fieldErrors
  const values = state.values

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
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/40"
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
            defaultValue={values?.cardName}
            aria-invalid={!!errors?.cardName?.length || undefined}
            aria-describedby={describedBy(!!errors?.cardName?.length && "cardName-error")}
            className={invalidClass(errors?.cardName)}
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
            defaultValue={values?.issuer}
            aria-invalid={!!errors?.issuer?.length || undefined}
            aria-describedby={describedBy(!!errors?.issuer?.length && "issuer-error")}
            className={invalidClass(errors?.issuer)}
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
            defaultValue={values?.lastFour}
            aria-invalid={!!errors?.lastFour?.length || undefined}
            aria-describedby={describedBy("lastFour-hint", !!errors?.lastFour?.length && "lastFour-error")}
            className={invalidClass(errors?.lastFour)}
          />
          <p id="lastFour-hint" className="text-xs text-muted-foreground">
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
            defaultValue={values?.creditLimit}
            aria-invalid={!!errors?.creditLimit?.length || undefined}
            aria-describedby={describedBy(!!errors?.creditLimit?.length && "creditLimit-error")}
            className={invalidClass(errors?.creditLimit)}
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
            defaultValue={values?.currentBalance}
            aria-invalid={!!errors?.currentBalance?.length || undefined}
            aria-describedby={describedBy(!!errors?.currentBalance?.length && "currentBalance-error")}
            className={invalidClass(errors?.currentBalance)}
          />
          <FieldError id="currentBalance-error" errors={errors?.currentBalance} />
        </div>
      </div>

      {/* Promo */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="hasPromo">0% intro APR active</Label>
            <p id="hasPromo-hint" className="text-xs text-muted-foreground">
              Track when a promotional 0% APR period ends
            </p>
          </div>
          <Switch
            id="hasPromo"
            name="hasPromo"
            checked={hasPromo}
            onCheckedChange={setHasPromo}
            aria-describedby="hasPromo-hint"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {hasPromo && (
            <div className="space-y-2">
              <Label htmlFor="promoEndsOn">0% APR end date</Label>
              <Input
                id="promoEndsOn"
                name="promoEndsOn"
                type="date"
                defaultValue={values?.promoEndsOn}
                aria-invalid={!!errors?.promoEndsOn?.length || undefined}
                aria-describedby={describedBy(!!errors?.promoEndsOn?.length && "promoEndsOn-error")}
                className={invalidClass(errors?.promoEndsOn)}
              />
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
              defaultValue={values?.regularApr}
              aria-invalid={!!errors?.regularApr?.length || undefined}
              aria-describedby={describedBy(!!errors?.regularApr?.length && "regularApr-error")}
              className={invalidClass(errors?.regularApr)}
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
            defaultValue={values?.paymentDueDay}
            aria-invalid={!!errors?.paymentDueDay?.length || undefined}
            aria-describedby={describedBy(!!errors?.paymentDueDay?.length && "paymentDueDay-error")}
            className={invalidClass(errors?.paymentDueDay)}
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
            defaultValue={values?.statementCloseDay}
            aria-invalid={!!errors?.statementCloseDay?.length || undefined}
            aria-describedby={describedBy(!!errors?.statementCloseDay?.length && "statementCloseDay-error")}
            className={invalidClass(errors?.statementCloseDay)}
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
            defaultValue={values?.minimumPayment}
            aria-invalid={!!errors?.minimumPayment?.length || undefined}
            aria-describedby={describedBy(
              "minimumPayment-hint",
              !!errors?.minimumPayment?.length && "minimumPayment-error"
            )}
            className={invalidClass(errors?.minimumPayment)}
          />
          <p id="minimumPayment-hint" className="text-xs text-muted-foreground">
            Required minimum from your statement
          </p>
          <FieldError id="minimumPayment-error" errors={errors?.minimumPayment} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentNote">Payment note</Label>
          <Input
            id="paymentNote"
            name="paymentNote"
            placeholder='e.g. "$350/month" or "Statement Amt"'
            defaultValue={values?.paymentNote}
            aria-invalid={!!errors?.paymentNote?.length || undefined}
            aria-describedby={describedBy(
              "paymentNote-hint",
              !!errors?.paymentNote?.length && "paymentNote-error"
            )}
            className={invalidClass(errors?.paymentNote)}
          />
          <p id="paymentNote-hint" className="text-xs text-muted-foreground">
            What you intend to pay each month
          </p>
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
          defaultValue={values?.notes}
          aria-invalid={!!errors?.notes?.length || undefined}
          aria-describedby={describedBy(!!errors?.notes?.length && "notes-error")}
          className={invalidClass(errors?.notes)}
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
