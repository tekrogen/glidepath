"use client"

/**
 * Sidebar "+ Add Card" CTA (issue #26) — the un-gated replacement for the
 * shell's disabled span. Keeps the uppercase-mono CTA idiom; lives outside
 * the primary nav by design (mockup IA). Presentational: the shell owns
 * the single sheet instance (outside the unmounting mobile drawer) and
 * passes the open handler in.
 */
export function AddCardTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      + Add Card
    </button>
  )
}
