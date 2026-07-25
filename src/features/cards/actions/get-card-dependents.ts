"use server"

/**
 * Fresh dependents read for the delete confirmation (issue #47/#57, review
 * finding): the dialog must list what deletion will ACTUALLY remove, not
 * the page-load snapshot — payments/statements can appear between page
 * render and the delete click. Read-only; household-scoped in the service.
 */
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { getCardDependentsForUser } from "@/features/cards/server/service"

export type CardDependents = {
  scheduledPayments: number
  statements: number
  autopayLink: boolean
}

export async function getCardDependents(cardId: string): Promise<CardDependents | null> {
  const session = await auth()
  if (!session?.user || !hasPermission(session.user.role, "financial:read")) {
    return null
  }
  if (typeof cardId !== "string" || cardId.length === 0) return null
  const deps = await getCardDependentsForUser(session.user.id, cardId)
  if (!deps) return null
  return {
    scheduledPayments: deps.scheduledPayments,
    statements: deps.statements,
    autopayLink: deps.autopayLink,
  }
}
