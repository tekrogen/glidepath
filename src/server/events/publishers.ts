/**
 * Domain event publisher — synchronous in-process fan-out. The only
 * handler today writes the AuditLog row; handler failures are logged and
 * swallowed (an audit failure must not fail the mutation — same policy
 * as the auth callbacks).
 */
import { prisma } from "@/lib/db/prisma"

import type { DomainEvent } from "./types"

const AUDIT_ACTIONS: Record<DomainEvent["type"], string> = {
  CardAdded: "CARD_ADDED",
  CardFrozen: "CARD_FROZEN",
  CardUnfrozen: "CARD_UNFROZEN",
}

async function writeAuditLog(event: DomainEvent): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: event.userId,
      action: AUDIT_ACTIONS[event.type],
      resource: "cards",
      details: JSON.stringify({
        cardId: event.cardId,
        cardName: event.cardName,
        householdId: event.householdId,
      }),
      success: true,
    },
  })
}

const handlers: Array<(event: DomainEvent) => Promise<void>> = [writeAuditLog]

export async function emitDomainEvent(event: DomainEvent): Promise<void> {
  for (const handler of handlers) {
    try {
      await handler(event)
    } catch (error) {
      console.error(`Domain event handler failed for ${event.type}:`, error)
    }
  }
}
