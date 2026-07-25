"use client"

/**
 * Edit-card sheet (issue #47) — the add-card sheet idiom applied to
 * update (the 2026-07-17 mockup's full-page container is superseded per
 * EDR-013; its field set + footer survive). Dismissal is guarded while a
 * save or delete is in flight. Keyed by card so switching rows remounts
 * the form with fresh seeds.
 */
import { useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import type { HouseholdMemberOption } from "./card-form-fields"
import { EditCardForm, type EditCardSeed } from "./edit-card-form"

export function EditCardSheet({
  seed,
  members,
  onClose,
}: {
  /** null ⇒ closed. */
  seed: EditCardSeed | null
  members: HouseholdMemberOption[]
  onClose: () => void
}) {
  const [pending, setPending] = useState(false)
  return (
    <Sheet
      open={seed != null}
      onOpenChange={(next) => {
        // A monetary mutation is in flight: Escape/overlay-close would
        // silently discard a server-confirmed outcome. Ignore until settle.
        if (!next && pending) return
        if (!next) onClose()
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit card</SheetTitle>
          <SheetDescription>{seed?.cardName ?? ""}</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          {seed && (
            <EditCardForm
              key={seed.cardId}
              seed={seed}
              members={members}
              onDone={onClose}
              onPendingChange={setPending}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
