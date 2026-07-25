"use server"

/**
 * Edit-card server action (issue #47) — the create-card template applied
 * to update: zod → household authz → service → CardUpdated event → audit →
 * revalidate → discriminated result. Failures return state (never throw);
 * server-confirmed, no optimistic update (monetary-mutation policy); raw
 * strings echo back so the form re-seeds after React 19 resets.
 */
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { editCardSchema } from "@/features/cards/schemas/edit-card-schema"
import { ForeignOwnerError, updateCardForUser } from "@/features/cards/server/service"

export type EditCardState = {
  success: boolean
  message: string
  fieldErrors?: Record<string, string[]>
  /** Raw FormData strings, echoed on failure only — never parsed values. */
  values?: Record<string, string>
}

function rawValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value
  }
  return values
}

export async function editCard(
  _prev: EditCardState,
  formData: FormData
): Promise<EditCardState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized.", values: rawValues(formData) }
  }

  const parsed = editCardSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      values: rawValues(formData),
    }
  }

  try {
    await updateCardForUser(session.user.id, parsed.data)
  } catch (error) {
    if (error instanceof ForeignOwnerError) {
      return {
        success: false,
        message: "Check the highlighted fields.",
        fieldErrors: { ownerMemberId: [error.message] },
        values: rawValues(formData),
      }
    }
    console.error("editCard failed:", error)
    return {
      success: false,
      message: "The card could not be saved — your entries are still here, so try again.",
      values: rawValues(formData),
    }
  }

  revalidatePath("/cards")
  revalidatePath("/overview")
  revalidatePath("/payments")
  return { success: true, message: `${parsed.data.cardName} saved.` }
}
