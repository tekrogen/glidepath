"use server"

/**
 * Unfreeze-card server action (issue #27) — the inverse of freeze-card.
 * Clears the in-app FROZEN tracking state back to ACTIVE; the displayed
 * badge then reverts to the card's highest-priority alert through the one
 * status engine. Same auth/validate/revalidate flow as freezeCard.
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { setCardFrozenForUser } from "@/features/cards/server/service"

import type { FreezeResult } from "./freeze-card"

export async function unfreezeCard(cardId: string): Promise<FreezeResult> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  if (typeof cardId !== "string" || cardId.trim() === "") {
    return { success: false, message: "Invalid card." }
  }

  try {
    await setCardFrozenForUser(session.user.id, cardId, false)
  } catch (error) {
    console.error("unfreezeCard failed:", error)
    return { success: false, message: "Could not unfreeze the card — please try again." }
  }

  revalidatePath("/cards")
  revalidatePath("/overview")
  return { success: true, message: "Card unfrozen." }
}
