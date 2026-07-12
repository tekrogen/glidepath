"use client"

/**
 * Self-contained freeze/unfreeze control (issues #27, #12). A ghost trigger
 * opens a Popover confirm carrying the EDR-007 disclosure (in-app tracking
 * only) and a due-payment warning. Confirming sets an OWN optimistic lifecycle
 * override (instant verb flip), calls the mutation, and — on success — shows a
 * mandatory Undo toast + refreshes so server truth reconciles the override.
 * On failure it reverts and toasts the error.
 *
 * Extracted verbatim from cards-table.tsx so the table AND the overview card
 * rack share ONE freeze implementation (a duplicated mutation UI would drift —
 * review-blocking). Unlike the table's old copy it owns its optimistic state
 * per-instance and clears it in render when the `lifecycle` prop changes (server
 * truth after refresh) — the same prop-change adjustment #27 used on `rows`.
 * `onLifecycleChange` lets a consumer that renders the status badge in a
 * separate cell (the table) flip that badge optimistically too.
 */
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { EstimatedValue } from "@/components/ui/estimated-value"
import { DUE_SOON_DAYS, type Lifecycle } from "@/features/cards/utils/card-status"
import { freezeCard } from "@/features/cards/actions/freeze-card"
import { unfreezeCard } from "@/features/cards/actions/unfreeze-card"
import { formatMinor } from "@/lib/formatting"

export interface FreezeControlProps {
  cardId: string
  cardName: string
  lastFour: string | null
  /** Server-truth lifecycle. The control layers its own optimistic override on
   *  top of this and clears it when the prop changes (post-refresh). */
  lifecycle: Lifecycle
  /** Days until the next payment due date; drives the freeze-confirm warning. */
  dueInDays: number | null
  minPayCents: number | null
  hasEstimatedInputs: boolean
  /** Notify a consumer rendering the badge elsewhere (the table) of the
   *  optimistic lifecycle so its badge flips in lockstep. */
  onLifecycleChange?: (next: Lifecycle) => void
}

export function FreezeControl({
  cardId,
  cardName,
  lastFour,
  lifecycle,
  dueInDays,
  minPayCents,
  hasEstimatedInputs,
  onLifecycleChange,
}: FreezeControlProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Own optimistic override, reconciled to server truth on prop change.
  const [override, setLocalOverride] = useState<Lifecycle | null>(null)
  const [prevLifecycle, setPrevLifecycle] = useState(lifecycle)
  if (lifecycle !== prevLifecycle) {
    setPrevLifecycle(lifecycle)
    setLocalOverride(null)
  }
  const effective = override ?? lifecycle

  const setOverride = (next: Lifecycle) => {
    setLocalOverride(next)
    onLifecycleChange?.(next)
  }

  const frozen = effective === "FROZEN"
  const verb = frozen ? "Unfreeze" : "Freeze"
  const identity = lastFour ? `${cardName} ····${lastFour}` : cardName
  const showDueWarning =
    !frozen && dueInDays != null && dueInDays >= 0 && dueInDays <= DUE_SOON_DAYS

  const run = (nextFrozen: boolean) => {
    const next: Lifecycle = nextFrozen ? "FROZEN" : "ACTIVE"
    const prev: Lifecycle = nextFrozen ? "ACTIVE" : "FROZEN"
    startTransition(async () => {
      setOverride(next)
      const res = await (nextFrozen ? freezeCard(cardId) : unfreezeCard(cardId))
      if (!res.success) {
        setOverride(prev)
        toast.error(res.message)
        return
      }
      toast.success(res.message, {
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              setOverride(prev)
              const undo = await (nextFrozen ? unfreezeCard(cardId) : freezeCard(cardId))
              if (!undo.success) {
                setOverride(next)
                toast.error(undo.message)
                return
              }
              router.refresh()
            }),
        },
      })
      router.refresh()
    })
  }

  const onConfirm = () => {
    setOpen(false)
    run(!frozen)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`${verb} ${identity}`}
        >
          {verb}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-sm">
        <p className="font-medium">
          {verb} {cardName}
          {lastFour ? ` ····${lastFour}` : ""}?
        </p>
        {frozen ? (
          <p className="text-muted-foreground">
            This clears the frozen mark in Glidepath. It doesn&apos;t contact your issuer or change
            anything with your bank.
          </p>
        ) : (
          <p className="text-muted-foreground">
            This marks the card as frozen in Glidepath to help you track it. It doesn&apos;t contact
            your issuer or stop charges — freeze with your bank for that.
          </p>
        )}
        {showDueWarning && (
          <p className="rounded-md border border-warning/50 bg-warning/10 px-2 py-1.5 text-xs text-warning">
            Payment due in {dueInDays} {dueInDays === 1 ? "day" : "days"} — freezing
            won&apos;t change that.
            {minPayCents != null && (
              <>
                {" "}
                Minimum{" "}
                {hasEstimatedInputs ? (
                  <EstimatedValue>{formatMinor(minPayCents)}</EstimatedValue>
                ) : (
                  formatMinor(minPayCents)
                )}
                .
              </>
            )}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isPending}>
            {verb}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
