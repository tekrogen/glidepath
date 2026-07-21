"use server"

/**
 * Reschedule-payment server action (issue #44). Record-only (EDR-010):
 * moves a tracked ScheduledPayment's date — it never touches a real
 * payment. Mirrors the freeze-card template: auth → permission →
 * validate → service → revalidate → typed result. Failures return a
 * result (never throw) so the client can revert its optimistic move and
 * toast the message.
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import {
  RescheduleDateError,
  reschedulePaymentForUser,
} from "@/features/payments/server/service"

export type RescheduleResult = {
  success: boolean
  message: string
  /** Echo of the persisted date (yyyy-mm-dd) on success. */
  scheduledFor?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function reschedulePayment(
  paymentId: string,
  toDate: string
): Promise<RescheduleResult> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { success: false, message: "Not authorized." }
  }
  if (typeof paymentId !== "string" || paymentId.trim() === "") {
    return { success: false, message: "Invalid payment." }
  }
  if (typeof toDate !== "string" || !ISO_DATE.test(toDate)) {
    return { success: false, message: "Invalid date." }
  }
  const scheduledFor = new Date(`${toDate}T00:00:00Z`)
  // Round-trip check: Date.parse ROLLS OVER out-of-range days ("2026-02-31"
  // parses to Mar 3) — reject, never reinterpret (review finding).
  if (
    Number.isNaN(scheduledFor.getTime()) ||
    scheduledFor.toISOString().slice(0, 10) !== toDate
  ) {
    return { success: false, message: "Invalid date." }
  }

  try {
    await reschedulePaymentForUser(session.user.id, paymentId, scheduledFor)
  } catch (error) {
    if (error instanceof RescheduleDateError) {
      return {
        success: false,
        message:
          error.rule === "past"
            ? "That date has already passed — reload to get today's runway."
            : "Payments can only move within the 45-day runway window.",
      }
    }
    console.error("reschedulePayment failed:", error)
    return { success: false, message: "Could not move the payment — please try again." }
  }

  revalidatePath("/payments")
  revalidatePath("/overview")
  return { success: true, message: "Payment moved.", scheduledFor: toDate }
}
