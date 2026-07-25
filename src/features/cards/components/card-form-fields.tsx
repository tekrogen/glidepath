"use client"

/**
 * Shared card form fields (issue #47) — the ONE field set both the add and
 * edit forms render, so parsers, labels, hints, and a11y wiring never
 * drift between them. Owner picker included (issue #78): a native select
 * ("Shared" = no owner member — the stepper's recorded OS-picker
 * preference). Every input re-seeds `values ?? seed` — `values` is the
 * action's raw-string echo after a failure (React 19 resets), `seed` is
 * the edit form's current-card strings; add passes no seed.
 */
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

export interface HouseholdMemberOption {
  id: string
  displayName: string
}

/** Join the ids that actually exist in the DOM right now. */
function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  const joined = ids.filter(Boolean).join(" ")
  return joined || undefined
}

/** Error border for fields the banner promises are "highlighted". */
function invalidClass(errors?: string[]): string | undefined {
  return errors?.length ? "border-destructive" : undefined
}

export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p id={id} className="text-xs text-error-text" role="alert">
      {errors[0]}
    </p>
  )
}

export function CardFormFields({
  errors,
  values,
  seed,
  hasPromo,
  onHasPromoChange,
  members,
}: {
  errors?: Record<string, string[]>
  /** Raw strings echoed by the action after a failed submit. */
  values?: Record<string, string>
  /** The edit form's current-card strings; wins only when `values` is absent. */
  seed?: Record<string, string>
  hasPromo: boolean
  onHasPromoChange: (on: boolean) => void
  members: HouseholdMemberOption[]
}) {
  const def = (key: string) => values?.[key] ?? seed?.[key]

  return (
    <>
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
            defaultValue={def("cardName")}
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
            defaultValue={def("issuer")}
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
            defaultValue={def("lastFour")}
            aria-invalid={!!errors?.lastFour?.length || undefined}
            aria-describedby={describedBy("lastFour-hint", !!errors?.lastFour?.length && "lastFour-error")}
            className={invalidClass(errors?.lastFour)}
          />
          <p id="lastFour-hint" className="text-xs text-muted-foreground">
            Only the last 4 — never the full card number
          </p>
          <FieldError id="lastFour-error" errors={errors?.lastFour} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerMemberId">Owner</Label>
          <select
            id="ownerMemberId"
            name="ownerMemberId"
            defaultValue={def("ownerMemberId") ?? ""}
            data-testid="owner-select"
            aria-invalid={!!errors?.ownerMemberId?.length || undefined}
            aria-describedby={describedBy(
              "ownerMemberId-hint",
              !!errors?.ownerMemberId?.length && "ownerMemberId-error"
            )}
            className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              errors?.ownerMemberId?.length ? "border-destructive" : ""
            }`}
          >
            <option value="">Shared — whole household</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <p id="ownerMemberId-hint" className="text-xs text-muted-foreground">
            Whose card this is — shown as the owner chip
          </p>
          <FieldError id="ownerMemberId-error" errors={errors?.ownerMemberId} />
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
            defaultValue={def("creditLimit")}
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
            defaultValue={def("currentBalance")}
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
            onCheckedChange={onHasPromoChange}
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
                defaultValue={def("promoEndsOn")}
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
              defaultValue={def("regularApr")}
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
            defaultValue={def("paymentDueDay")}
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
            defaultValue={def("statementCloseDay")}
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
            defaultValue={def("minimumPayment")}
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
            defaultValue={def("paymentNote")}
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
          defaultValue={def("notes")}
          aria-invalid={!!errors?.notes?.length || undefined}
          aria-describedby={describedBy(!!errors?.notes?.length && "notes-error")}
          className={invalidClass(errors?.notes)}
        />
        <FieldError id="notes-error" errors={errors?.notes} />
      </div>
    </>
  )
}
