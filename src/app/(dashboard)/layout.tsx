/**
 * Dashboard Layout
 *
 * Layout for all authenticated interior pages.
 * Provides the Glidepath sidebar shell (mockup UIUX architecture, EDR-013)
 * and fetches the notification panel for the header bell (issue #25) —
 * AppShell is a client component and cannot fetch.
 * No Footer — dashboard pages don't show the marketing footer.
 */

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";
import { getNotificationPanelForUser } from "@/features/notifications";
import type { NotificationPanel } from "@/features/notifications";

interface DashboardGroupLayoutProps {
  children: ReactNode;
}

const EMPTY_PANEL: NotificationPanel = { notifications: [], unreadCount: 0 };

export default async function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  const session = await auth();
  const panel = session?.user?.id
    ? await getNotificationPanelForUser(session.user.id)
    : EMPTY_PANEL;

  return (
    <>
      <AppShell notificationPanel={panel}>{children}</AppShell>
    </>
  );
}
