"use server"

/**
 * Create-card server action (issue #26) — the app's first CreditCard
 * mutation and the template later mutations copy:
 *
 *   zod → household authz → service → repository → CardAdded event →
 *   audit → revalidate → discriminated result
 *
 * Feeds useActionState: failures return state (never throw), and the
 * mutation is server-confirmed — the UI shows pending, no optimistic
 * update (monetary-mutation policy). Every failure echoes the raw
 * submitted strings back as `values` so the form can re-seed its inputs —
 * React 19 resets uncontrolled fields after the action settles.
 */
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { createCardSchema } from "@/features/cards/schemas/create-card-schema"
import { createCardForUser } from "@/features/cards/server/service"

export type CreateCardState = {
  success: boolean
  message: string
  cardId?: string
  fieldErrors?: Record<string, string[]>
  /** Raw FormData strings, echoed on failure only — never parsed values. */
  values?: Record<string, string>
}

/** The user's typed strings, verbatim — for re-seeding inputs after failure. */
function rawValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value
  }
  return values
}

export async function createCard(
  _prev: CreateCardState,
  formData: FormData
): Promise<CreateCardState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized.", values: rawValues(formData) }
  }

  const parsed = createCardSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: rawValues(formData),
    }
  }

  let cardId: string
  try {
    ;({ cardId } = await createCardForUser(session.user.id, parsed.data))
  } catch (error) {
    console.error("createCard failed:", error)
    return {
      success: false,
      message:
        "The card could not be added — your entries are still here, so try again, or use Link an institution below.",
      values: rawValues(formData),
    }
  }

  // Path-based invalidation: the app has no tag-cache infrastructure yet
  // (pages are force-dynamic + React cache); revalidateTag arrives when
  // unstable_cache does.
  revalidatePath("/cards")
  revalidatePath("/overview")
  return { success: true, message: `${parsed.data.cardName} added.`, cardId }
}
