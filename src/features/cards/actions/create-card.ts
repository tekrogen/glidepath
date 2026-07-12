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
 * update (monetary-mutation policy).
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
}

export async function createCard(
  _prev: CreateCardState,
  formData: FormData
): Promise<CreateCardState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }

  const parsed = createCardSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  let cardId: string
  try {
    ;({ cardId } = await createCardForUser(session.user.id, parsed.data))
  } catch (error) {
    console.error("createCard failed:", error)
    return { success: false, message: "The card could not be added. Please try again." }
  }

  revalidatePath("/cards")
  revalidatePath("/overview")
  return { success: true, message: `${parsed.data.cardName} added.`, cardId }
}
