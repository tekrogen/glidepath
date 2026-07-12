/**
 * Dashboard Layout
 *
 * Layout for all authenticated interior pages.
 * Provides the Glidepath sidebar shell (mockup UIUX architecture, EDR-013).
 * No Footer — dashboard pages don't show the marketing footer.
 */

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

interface DashboardGroupLayoutProps {
  children: ReactNode;
}

export default function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  return (
    <>
      <AppShell>{children}</AppShell>
    </>
  );
}
