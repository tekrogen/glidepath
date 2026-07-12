"use client"

/**
 * Add-card CTA for the Overview placeholders (issue #12). Opens the SAME
 * working add-card sheet the sidebar uses (issue #26) via its own controlled
 * instance — an honest link to a flow that exists, never the unbuilt import
 * UI or the legacy /connect-account path. Keeps the uppercase-mono CTA idiom.
 */
import { useState } from "react"

import { AddCardSheet } from "@/features/cards/components/add-card-sheet"

export function AddCardCta({ label = "Add a card" }: { label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {label}
      </button>
      <AddCardSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
