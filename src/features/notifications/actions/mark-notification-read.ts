"use server"

/**
 * Mark-read server action. Session-only auth (no financial:write —
 * notifications are not financial mutations); ownership is enforced by
 * the userId-scoped update in the repository.
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"

import { markNotificationRead as markRead } from "../server/service"

export async function markNotificationRead(id: string): Promise<{ success: boolean; message: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, message: "Not authorized" }
  }
  if (typeof id !== "string" || id.trim() === "") {
    return { success: false, message: "A notification id is required." }
  }

  await markRead(session.user.id, id)
  revalidatePath("/overview")
  return { success: true, message: "Notification marked read." }
}
