/**
 * Notifications service — persists attention items as in-app notifications
 * (issue #25). The sync only inserts: the (userId, dedupeKey) unique key
 * makes re-inserts no-ops, and existing rows are never updated or deleted,
 * so read/dismiss state survives every sync.
 */
import type { NotificationType } from "@prisma/client"
import type { AttentionItem } from "@/features/overview/utils/build-attention-items"

import {
  countUnreadForUser,
  dismiss,
  findRecentForUser,
  insertNotificationsSkippingDuplicates,
  markRead,
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

export async function syncAttentionNotifications(userId: string, items: AttentionItem[]): Promise<void> {
  await insertNotificationsSkippingDuplicates(
    items.map((i) => ({
      userId,
      type: i.type as NotificationType,
      entityRef: i.entityRef,
      dedupeKey: i.dedupeKey,
      title: i.title,
      body: i.body,
      href: i.href,
    }))
  )
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
