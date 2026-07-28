"use server"

/**
 * Plaid discovered-cards + suggestion actions (issue #109), on the locked
 * mutation template: authz → service → event/audit (inside the service) →
 * revalidate → discriminated result. Server-confirmed, no optimistic UI
 * (monetary-mutation policy).
 */
import { revalidatePath } from "next/cache"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import {
  importDiscoveredCardsForUser,
  resolveSuggestionForUser,
  type ImportDiscoveredResult,
} from "@/features/cards/server/plaid-cards-service"

export type ImportDiscoveredState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; result: ImportDiscoveredResult }

export async function importDiscoveredCards(
  _prev: ImportDiscoveredState,
  formData: FormData
): Promise<ImportDiscoveredState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { status: "error", message: "Not authorized." }
  }

  const accountIds = formData
    .getAll("accountId")
    .filter((v): v is string => typeof v === "string" && v.length > 0)
  if (accountIds.length === 0) {
    return { status: "error", message: "Select at least one account to import." }
  }

  try {
    const result = await importDiscoveredCardsForUser(session.user.id, accountIds)
    revalidatePath("/cards")
    revalidatePath("/overview")
    return { status: "done", result }
  } catch (error) {
    console.error("Discovered-cards import failed:", error)
    return { status: "error", message: "Import failed. Please try again." }
  }
}

export type ResolveSuggestionState = { status: "idle" } | { status: "error"; message: string } | { status: "done" }

async function resolve(
  formData: FormData,
  resolution: "accepted" | "dismissed"
): Promise<ResolveSuggestionState> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:write")) {
    return { status: "error", message: "Not authorized." }
  }
  const suggestionId = formData.get("suggestionId")
  if (typeof suggestionId !== "string" || !suggestionId) {
    return { status: "error", message: "Missing suggestion." }
  }
  try {
    const outcome = await resolveSuggestionForUser(session.user.id, suggestionId, resolution)
    if (outcome === "not-found") {
      // Already resolved elsewhere or foreign — refresh clears the row either way.
      revalidatePath("/cards")
      return { status: "error", message: "That suggestion is no longer open." }
    }
    revalidatePath("/cards")
    revalidatePath("/overview")
    return { status: "done" }
  } catch (error) {
    console.error("Suggestion resolution failed:", error)
    return { status: "error", message: "Could not update the card. Please try again." }
  }
}

export async function acceptSuggestion(
  _prev: ResolveSuggestionState,
  formData: FormData
): Promise<ResolveSuggestionState> {
  return resolve(formData, "accepted")
}

export async function dismissSuggestion(
  _prev: ResolveSuggestionState,
  formData: FormData
): Promise<ResolveSuggestionState> {
  return resolve(formData, "dismissed")
}
