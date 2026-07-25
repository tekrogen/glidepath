"use server"

/**
 * Delete-card server action (issue #47 + #57's delete half). Explicit
 * audited removal: the service deletes the card AND its Restrict-linked
 * rows (scheduled payments, statements, autopay link) in one transaction,
 * emitting CardDeleted with exact counts. The UI's confirm dialog lists
 * those dependents BEFORE this runs — this action assumes an informed
 * confirm. Failures return a result (never throw).
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { deleteCardForUser } from "@/features/cards/server/service"

export type DeleteCardResult = {
  success: boolean
  message: string
}

export async function deleteCard(cardId: string): Promise<DeleteCardResult> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  if (typeof cardId !== "string" || cardId.length === 0) {
    return { success: false, message: "Missing card id." }
  }

  let cardName: string
  try {
    ;({ cardName } = await deleteCardForUser(session.user.id, cardId))
  } catch (error) {
    console.error("deleteCard failed:", error)
    return { success: false, message: "The card could not be deleted — please try again." }
  }

  revalidatePath("/cards")
  revalidatePath("/overview")
  revalidatePath("/payments")
  return { success: true, message: `${cardName} deleted.` }
}
