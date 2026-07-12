"use client"

/**
 * Sidebar "+ Add Card" CTA (issue #26) — the un-gated replacement for the
 * shell's disabled span. Keeps the uppercase-mono CTA idiom; lives outside
 * the primary nav by design (mockup IA).
 */
import { useState } from "react"

import { AddCardSheet } from "./add-card-sheet"

export function AddCardTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-primary hover:bg-primary/10"
      >
        + Add Card
      </button>
      <AddCardSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
