/**
 * Notifications repository — the only module that touches Prisma for the
 * notifications domain (arch doc §15). Inserts are idempotent via the
 * (userId, dedupeKey) unique key; mutations are ownership-guarded by the
 * userId in the where-clause.
 */
import { prisma } from "@/lib/db/prisma"
import type { NotificationType } from "@prisma/client"

export interface NotificationRow {
  userId: string
  type: NotificationType
  entityRef: string | null
  dedupeKey: string
  title: string
  body: string
  href: string | null
}

export async function insertNotificationsSkippingDuplicates(rows: NotificationRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const res = await prisma.notification.createMany({ data: rows, skipDuplicates: true })
  return res.count
}

export async function findRecentForUser(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function countUnreadForUser(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null, dismissedAt: null } })
}

export async function markRead(userId: string, id: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  })
  return res.count
}

export async function dismiss(userId: string, id: string): Promise<number> {
  const res = await prisma.notification.updateMany({
    where: { id, userId, dismissedAt: null },
    data: { dismissedAt: new Date() },
  })
  return res.count
}
