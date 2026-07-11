/**
 * Dashboard Layout
 *
 * Layout for all authenticated interior pages.
 * Provides Navbar + sidebar navigation via DashboardLayout.
 * No Footer — dashboard pages don't show the marketing footer.
 */

import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

interface DashboardGroupLayoutProps {
  children: ReactNode;
}

export default function DashboardGroupLayout({ children }: DashboardGroupLayoutProps) {
  return (
    <>
      <Navbar />
      <DashboardLayout>{children}</DashboardLayout>
    </>
  );
}
