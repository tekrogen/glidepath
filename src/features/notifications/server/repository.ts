/**
 * Notifications repository — the only module that touches Prisma for the
 * notifications domain (arch doc §15). The table holds the CURRENT
 * attention occurrences (occurrence-lifecycle semantics, F15); mutations
 * are ownership-guarded by the userId in the where-clause.
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

/**
 * Reconcile the stored set with the current occurrences, atomically:
 * upsert each row by (userId, dedupeKey) — updates refresh only the display
 * fields so readAt/dismissedAt survive re-syncs of the same occurrence —
 * and delete every row whose occurrence is no longer current (including
 * dismissed ones, so a NEW episode of the same condition re-notifies).
 */
export async function replaceCurrentForUser(userId: string, rows: NotificationRow[]): Promise<void> {
  const currentKeys = rows.map((r) => r.dedupeKey)
  await prisma.$transaction([
    ...rows.map((r) =>
      prisma.notification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: r.dedupeKey } },
        create: r,
        update: { title: r.title, body: r.body, href: r.href },
      })
    ),
    // notIn: [] matches nothing — an empty attention set must clear all rows.
    prisma.notification.deleteMany({
      where: { userId, ...(currentKeys.length > 0 ? { dedupeKey: { notIn: currentKeys } } : {}) },
    }),
  ])
}

export async function findRecentForUser(userId: string, limit = 50) {
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
