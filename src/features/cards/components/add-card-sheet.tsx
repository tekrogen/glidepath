"use client"

/**
 * Add-card sheet (issue #26). Manual entry is the primary, immediately
 * visible path (EDR-005/EDR-022); linking an institution is the gated
 * secondary block that hands off to the existing /connect-account flow.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Landmark } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { AddCardForm } from "./add-card-form"

export function AddCardSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // A monetary mutation is in flight: Escape/overlay-close would
        // silently discard a server-confirmed outcome. Ignore until settle.
        if (!next && pending) return
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add card</SheetTitle>
          <SheetDescription>Track a card manually, or link an institution.</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <AddCardForm onDone={() => onOpenChange(false)} onPendingChange={setPending} />
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              Link with your bank — balances and limits sync automatically
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => router.push("/connect-account")}
          >
            Link an institution
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
