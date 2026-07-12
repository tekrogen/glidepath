"use server"

/**
 * Freeze-card server action (issue #27). An in-app tracking state only
 * (EDR-007) — it never contacts the issuer or blocks charges. Mirrors the
 * #25 notification action idiom (typed id arg, not FormData) and the
 * create-card template: auth → validate → service → revalidate → result.
 * Failures return a result (never throw) so the client can revert its
 * optimistic override and toast the message.
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { setCardFrozenForUser } from "@/features/cards/server/service"

export type FreezeResult = { success: boolean; message: string }

export async function freezeCard(cardId: string): Promise<FreezeResult> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  if (typeof cardId !== "string" || cardId.trim() === "") {
    return { success: false, message: "Invalid card." }
  }

  try {
    await setCardFrozenForUser(session.user.id, cardId, true)
  } catch (error) {
    console.error("freezeCard failed:", error)
    return { success: false, message: "Could not freeze the card — please try again." }
  }

  revalidatePath("/cards")
  revalidatePath("/overview")
  return { success: true, message: "Card frozen." }
}
