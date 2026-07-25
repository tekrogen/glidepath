/**
 * Notifications queries — auth-aware, request-cached entry points (arch doc
 * §15). Write-on-read is deliberate (issue #25): attention conditions are
 * time-based, not mutation-based, so the panel read syncs the current
 * occurrence set (idempotently) before returning — no cron needed. Since
 * issue #46 the synced set is attention items ∪ payment reminders
 * (per-due-occurrence + imminent planned payments); on a shared dedupeKey
 * the attention item wins, so established wording/hrefs are unchanged.
 */
import { cache } from "react"

import { getPortfolioForUser } from "@/features/cards"
import { buildAttentionItems } from "@/features/overview"
import { getRunwayForUser } from "@/features/payments"
import { buildReminderItems } from "@/features/notifications/utils/build-reminder-items"

import { getNotificationPanel, syncOccurrenceNotifications } from "./service"

export const getNotificationPanelForUser = cache(async (userId: string) => {
  const [{ cards, asOf }, runway] = await Promise.all([
    getPortfolioForUser(userId),
    getRunwayForUser(userId),
  ])
  const attention = buildAttentionItems(cards, asOf)
  const reminders = buildReminderItems(runway.cards, runway.payments, asOf)
  await syncOccurrenceNotifications(userId, attention, reminders)
  return getNotificationPanel(userId)
})
