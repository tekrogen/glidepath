"use server"

/**
 * Stepper server actions (issue #45): save-draft, confirm, discard.
 * Record-only throughout (EDR-010) — confirm records a tracked
 * ScheduledPayment, it never moves money. Template: zod → auth/permission
 * → service → revalidate → discriminated result (failures return, never
 * throw). Monetary-mutation policy: confirm is server-confirmed, the UI
 * shows pending — no optimistic update.
 */
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { intentDraftSchema } from "@/features/payments/schemas/intent-draft-schema"
import {
  confirmIntentForUser,
  discardIntentDraftForUser,
  IntentRuleError,
  saveIntentDraftForUser,
} from "@/features/payments/server/service"

export type SaveDraftState = {
  success: boolean
  message: string
  intentId?: string
  /** ISO timestamp the draft now expires at (sliding TTL). */
  expiresAt?: string
  fieldErrors?: Record<string, string[]>
  /** Set when the draft was already confirmed — the stepper leaves the flow. */
  rule?: "already-submitted"
}

export async function saveIntentDraft(input: Record<string, string>): Promise<SaveDraftState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  const parsed = intentDraftSchema(new Date()).safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  try {
    const { intentId, expiresAt } = await saveIntentDraftForUser(session.user.id, parsed.data)
    return {
      success: true,
      message: "Draft saved.",
      intentId,
      expiresAt: expiresAt.toISOString(),
    }
  } catch (error) {
    if (error instanceof IntentRuleError) {
      if (error.rule === "already-submitted") {
        return { success: false, message: error.message, rule: "already-submitted" }
      }
      if (error.rule === "foreign-card") {
        return { success: false, message: error.message, fieldErrors: { cardId: [error.message] } }
      }
      if (error.rule === "foreign-account") {
        return {
          success: false,
          message: error.message,
          fieldErrors: { fundingAccountId: [error.message] },
        }
      }
    }
    console.error("saveIntentDraft failed:", error)
    return { success: false, message: "The draft could not be saved — please try again." }
  }
}

export type ConfirmIntentState = {
  success: boolean
  message: string
  paymentId?: string
  /** True when this confirm found the payment already recorded (idempotent path). */
  alreadyRecorded?: boolean
  /** Set for rule failures the stepper can react to (e.g. send the user back). */
  rule?: "expired" | "incomplete" | "not-found" | "foreign-card" | "foreign-account"
}

export async function confirmIntent(intentId: string): Promise<ConfirmIntentState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  if (typeof intentId !== "string" || intentId.trim() === "") {
    return { success: false, message: "Invalid draft." }
  }
  try {
    const { paymentId, alreadyRecorded } = await confirmIntentForUser(session.user.id, intentId)
    revalidatePath("/payments")
    revalidatePath("/overview")
    return {
      success: true,
      message: alreadyRecorded ? "This payment was already recorded." : "Payment recorded.",
      paymentId,
      alreadyRecorded,
    }
  } catch (error) {
    if (error instanceof IntentRuleError && error.rule !== "already-submitted") {
      return { success: false, message: error.message, rule: error.rule }
    }
    console.error("confirmIntent failed:", error)
    return { success: false, message: "The payment could not be recorded — please try again." }
  }
}

export type DiscardDraftState = { success: boolean; message: string }

export async function discardIntentDraft(intentId: string): Promise<DiscardDraftState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  if (typeof intentId !== "string" || intentId.trim() === "") {
    return { success: false, message: "Invalid draft." }
  }
  try {
    await discardIntentDraftForUser(session.user.id, intentId)
    return { success: true, message: "Draft discarded." }
  } catch (error) {
    console.error("discardIntentDraft failed:", error)
    return { success: false, message: "The draft could not be discarded — please try again." }
  }
}
