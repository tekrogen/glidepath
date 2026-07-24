/**
 * Notifications service — persists attention items as in-app notifications
 * (issue #25). Occurrence-lifecycle semantics (F15): the store always holds
 * exactly the CURRENT attention occurrences with their read/dismiss state.
 * A re-sync of the same occurrence (same dedupeKey) keeps that state; an
 * occurrence that resolves or rolls over is deleted — dismissed or not — so
 * a new episode of the same condition re-notifies, while a dismissal
 * suppresses the occurrence only for as long as it persists.
 */
import type { NotificationType } from "@prisma/client"
import type { AttentionItem } from "@/features/overview/utils/build-attention-items"
import type { ReminderItem } from "@/features/notifications/utils/build-reminder-items"

import {
  countUnreadForUser,
  dismiss,
  findRecentForUser,
  markRead,
  replaceCurrentForUser,
  type NotificationRow,
} from "./repository"

/** Plain-serializable — safe to cross the RSC → client boundary (no bigint, no Date). */
export interface NotificationDTO {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  createdAt: string // ISO
  read: boolean
}

export interface NotificationPanel {
  notifications: NotificationDTO[]
  unreadCount: number
}

/**
 * Reconcile the store with the CURRENT occurrence set: attention items ∪
 * payment reminders (issue #46). Shared dedupeKeys keep the attention
 * item — reminders only add occurrences the feed doesn't already carry.
 */
export async function syncOccurrenceNotifications(
  userId: string,
  attention: AttentionItem[],
  reminders: ReminderItem[]
): Promise<void> {
  const rows = new Map<string, NotificationRow>()
  for (const i of [...reminders, ...attention]) {
    rows.set(i.dedupeKey, {
      userId,
      type: i.type as NotificationType,
      entityRef: i.entityRef,
      dedupeKey: i.dedupeKey,
      title: i.title,
      body: i.body,
      href: i.href,
    })
  }
  await replaceCurrentForUser(userId, [...rows.values()])
}

export async function getNotificationPanel(userId: string): Promise<NotificationPanel> {
  const [rows, unreadCount] = await Promise.all([findRecentForUser(userId), countUnreadForUser(userId)])
  return {
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      href: r.href,
      createdAt: r.createdAt.toISOString(),
      read: r.readAt != null,
    })),
    unreadCount,
  }
}

/** Returns the affected-row count (0 ⇒ not found / not owned / already done). */
export async function markNotificationRead(userId: string, id: string): Promise<number> {
  return markRead(userId, id)
}

/** Returns the affected-row count (0 ⇒ not found / not owned / already done). */
export async function dismissNotification(userId: string, id: string): Promise<number> {
  return dismiss(userId, id)
}
