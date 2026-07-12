/**
 * Notifications queries — auth-aware, request-cached entry points (arch doc
 * §15). Write-on-read is deliberate (issue #25): attention conditions are
 * time-based, not mutation-based, so the panel read syncs the current
 * attention set (idempotently) before returning — no cron needed in Phase 2.
 */
import { cache } from "react"

import { getPortfolioForUser } from "@/features/cards"
import { buildAttentionItems } from "@/features/overview"

import { getNotificationPanel, syncAttentionNotifications } from "./service"

export const getNotificationPanelForUser = cache(async (userId: string) => {
  const { cards, asOf } = await getPortfolioForUser(userId)
  await syncAttentionNotifications(userId, buildAttentionItems(cards, asOf))
  return getNotificationPanel(userId)
})
