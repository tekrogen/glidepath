"use client"

/**
 * Payment scheduling stepper (issue #45, Blueprint F6): three steps on a
 * DB-backed, resumable, expiring PaymentIntent draft. Every Continue
 * persists the draft (sliding 24h TTL) so a reload — or another tab —
 * resumes where the user left off. Confirm is record-only (EDR-010
 * disclosure on the review step) and server-confirmed with no optimistic
 * update (monetary-mutation policy); idempotency lives in the DB
 * (`intentId @unique`), so a double-submit converges on one payment.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { parseDollarsToMinor } from "@/lib/finance"
import { formatMinor, formatShortDate, toDollarInput } from "@/lib/formatting"
import {
  confirmIntent,
  discardIntentDraft,
  saveIntentDraft,
} from "@/features/payments/actions/intent-actions"
import type { PaymentStepperProps } from "@/features/payments/utils/serialize"

const STEPS = ["Card & amount", "Date & funding", "Review & confirm"] as const

/** Which step renders each field — a save error jumps the user to it. */
const FIELD_STEP: Record<string, number> = {
  cardId: 0,
  amount: 0,
  scheduledFor: 1,
  fundingAccountId: 1,
  note: 1,
}

interface Fields {
  cardId: string
  amount: string
  scheduledFor: string
  fundingAccountId: string
  note: string
}

const centsToDollars = (cents: number | null) => (cents == null ? "" : toDollarInput(cents))

export function PaymentStepper({ cards, fundingAccounts, draft, asOf }: PaymentStepperProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [intentId, setIntentId] = useState<string | null>(draft?.intentId ?? null)
  const [fields, setFields] = useState<Fields>({
    cardId: draft?.cardId ?? "",
    amount: centsToDollars(draft?.amountCents ?? null),
    scheduledFor: draft?.scheduledFor ?? "",
    fundingAccountId: draft?.fundingAccountId ?? "",
    note: draft?.note ?? "",
  })
  // Resume where the draft left off: complete → review, card+amount → step 2.
  const [step, setStep] = useState(() => {
    if (!draft) return 0
    if (draft.cardId && draft.amountCents != null && draft.scheduledFor) return 2
    if (draft.cardId && draft.amountCents != null) return 1
    return 0
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  // Focus lands on the step heading after a transition so keyboard/SR
  // users aren't dropped to <body>; the heading is aria-live-announced.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus()
    else mounted.current = true
  }, [step])

  const activeCards = useMemo(
    () => cards.filter((c) => c.lifecycle !== "ARCHIVED"),
    [cards]
  )
  const selectedCard = activeCards.find((c) => c.id === fields.cardId) ?? null
  const selectedAccount = fundingAccounts.find((a) => a.id === fields.fundingAccountId) ?? null

  const set = (patch: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...patch }))
    setFieldErrors({})
  }

  /** Persist the draft, then run `next` on success (advance / confirm). */
  const persistDraft = (next: (intentId: string) => Promise<void> | void) => {
    startTransition(async () => {
      const res = await saveIntentDraft({
        intentId: intentId ?? "",
        cardId: fields.cardId,
        amount: fields.amount,
        scheduledFor: fields.scheduledFor,
        fundingAccountId: fields.fundingAccountId,
        note: fields.note,
      })
      if (!res.success || !res.intentId) {
        // Another tab already recorded this draft — the flow is over.
        if (res.rule === "already-submitted") {
          toast.error(res.message)
          router.push("/payments")
          return
        }
        const errors = res.fieldErrors ?? {}
        setFieldErrors(errors)
        // Jump to the earliest step holding an errored field (a resumed
        // draft whose date has passed must not brick a later step).
        const steps = Object.keys(errors)
          .map((k) => FIELD_STEP[k])
          .filter((s) => s != null)
        if (steps.length > 0) setStep(Math.min(...steps))
        toast.error(res.message)
        return
      }
      setIntentId(res.intentId)
      await next(res.intentId)
    })
  }

  const stepValid =
    step === 0
      ? fields.cardId !== "" && fields.amount.trim() !== ""
      : step === 1
        ? fields.scheduledFor.trim() !== ""
        : true

  const handleContinue = () => persistDraft(() => setStep((s) => Math.min(2, s + 1)))

  // Confirm re-persists the on-screen fields first, so what the review
  // shows is exactly what gets recorded — a cross-tab edit can't slip a
  // different DB row under the user's confirmation (review finding).
  const handleConfirm = () =>
    persistDraft(async (id) => {
      const res = await confirmIntent(id)
      if (!res.success) {
        if (res.rule === "expired" || res.rule === "not-found") {
          toast.error(res.message)
          setIntentId(null)
          setStep(0)
          return
        }
        toast.error(res.message)
        return
      }
      toast.success(res.message)
      router.push("/payments")
    })

  const handleDiscard = () => {
    startTransition(async () => {
      if (intentId) await discardIntentDraft(intentId)
      setIntentId(null)
      setFields({ cardId: "", amount: "", scheduledFor: "", fundingAccountId: "", note: "" })
      setStep(0)
      toast.success("Draft discarded.")
    })
  }

  const error = (key: string) => fieldErrors[key]?.[0]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ol className="flex items-center gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            data-testid={`stepper-step-${i + 1}`}
            aria-current={i === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${
              i === step
                ? "border-primary bg-primary/10 text-primary"
                : i < step
                  ? "border-success/50 text-muted-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            <span className="font-mono tabular-nums">{i < step ? "✓" : i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <h2
            ref={headingRef}
            tabIndex={-1}
            aria-live="polite"
            className="text-sm font-semibold outline-none"
          >
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </h2>
          {step === 0 && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Which card?
                </legend>
                {/* Toggle buttons (aria-pressed), not radios — the app's
                    segmented-control idiom; radio semantics would promise
                    arrow-key roving this list doesn't implement. */}
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {activeCards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={fields.cardId === c.id}
                      onClick={() => set({ cardId: c.id })}
                      data-testid="stepper-card-option"
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                        fields.cardId === c.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{c.cardName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatMinor(c.balanceCents)}
                        {c.minimumPaymentCents != null && ` · min ${formatMinor(c.minimumPaymentCents)}`}
                      </span>
                    </button>
                  ))}
                </div>
                {error("cardId") && (
                  <p className="text-xs text-destructive" role="alert">
                    {error("cardId")}
                  </p>
                )}
              </fieldset>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Amount
                </span>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    value={fields.amount}
                    onChange={(e) => set({ amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-7 tabular-nums"
                    aria-label="Payment amount in dollars"
                    aria-invalid={error("amount") != null}
                    aria-describedby={error("amount") ? "amount-error" : undefined}
                    data-testid="payment-amount"
                  />
                </span>
                {error("amount") && (
                  <p id="amount-error" className="text-xs text-destructive">
                    {error("amount")}
                  </p>
                )}
                {selectedCard?.minimumPaymentCents != null && (
                  <button
                    type="button"
                    onClick={() => set({ amount: centsToDollars(selectedCard.minimumPaymentCents) })}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Use minimum · {formatMinor(selectedCard.minimumPaymentCents)}
                  </button>
                )}
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Payment date
                </span>
                <Input
                  type="date"
                  value={fields.scheduledFor}
                  onChange={(e) => set({ scheduledFor: e.target.value })}
                  min={asOf}
                  className="tabular-nums"
                  aria-invalid={error("scheduledFor") != null}
                  aria-describedby={error("scheduledFor") ? "scheduledFor-error" : undefined}
                  data-testid="payment-date"
                />
                {error("scheduledFor") && (
                  <p id="scheduledFor-error" className="text-xs text-destructive">
                    {error("scheduledFor")}
                  </p>
                )}
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Paid from <span className="normal-case tracking-normal">(optional)</span>
                </span>
                <select
                  value={fields.fundingAccountId}
                  onChange={(e) => set({ fundingAccountId: e.target.value })}
                  data-testid="funding-select"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No funding account</option>
                  {fundingAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.institution ? ` — ${a.institution}` : ""}
                      {a.lastFour ? ` ····${a.lastFour}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Note <span className="normal-case tracking-normal">(optional)</span>
                </span>
                <Input
                  value={fields.note}
                  onChange={(e) => set({ note: e.target.value })}
                  placeholder='e.g. "Statement Amt" or "$350/month"'
                  maxLength={200}
                  aria-invalid={error("note") != null}
                  aria-describedby={error("note") ? "note-error" : undefined}
                  data-testid="payment-note"
                />
                {error("note") && (
                  <p id="note-error" className="text-xs text-destructive">
                    {error("note")}
                  </p>
                )}
              </label>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3" data-testid="stepper-review">
              <dl className="space-y-2 text-sm">
                <ReviewRow label="Card" value={selectedCard?.cardName ?? "—"} testid="review-card" />
                <ReviewRow
                  label="Amount"
                  // Parsing is lib/finance's (EDR-019) — an unparseable draft
                  // amount shows "—" here and fails validation on Continue.
                  value={(() => {
                    const minor = parseDollarsToMinor(fields.amount)
                    return minor == null ? "—" : formatMinor(minor)
                  })()}
                  testid="review-amount"
                />
                <ReviewRow
                  label="Date"
                  // Year included — the stepper schedules up to a year out.
                  value={
                    fields.scheduledFor
                      ? formatShortDate(new Date(`${fields.scheduledFor}T00:00:00Z`))
                      : "—"
                  }
                  testid="review-date"
                />
                <ReviewRow label="Paid from" value={selectedAccount?.name ?? "Not set"} testid="review-funding" />
                {fields.note.trim() !== "" && (
                  <ReviewRow label="Note" value={fields.note} testid="review-note" />
                )}
              </dl>
              <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Record-only: this tracks a payment you&apos;ll make yourself — nothing is charged,
                moved, or sent to your bank.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={pending}
                  data-testid="stepper-back"
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                >
                  Back
                </button>
              )}
              {intentId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={pending}
                      data-testid="stepper-discard"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Start over
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Everything entered so far is deleted — there&apos;s no undo. No payment
                        has been recorded.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep draft</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDiscard} data-testid="stepper-discard-confirm">
                        Discard
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            {step < 2 ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={pending || !stepValid}
                data-testid="stepper-continue"
                className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                {pending ? "Saving…" : "Continue"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending || !intentId}
                data-testid="stepper-confirm"
                className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                {pending ? "Recording…" : "Record payment"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {intentId && (
        <p className="text-xs text-muted-foreground">
          Draft saved at each step — resume within 24 hours of the last save; unsaved edits on
          the current step stay in this tab only.
        </p>
      )}
    </div>
  )
}

function ReviewRow({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right tabular-nums" data-testid={testid}>
        {value}
      </dd>
    </div>
  )
}
