"use client";

/**
 * Glidepath app shell — UIUX architecture per the mockup (EDR-013):
 * a brand-first sidebar (logo header → primary nav → manage group →
 * appearance footer) with a slim utility strip over the content.
 * Colors, fonts, and tokens come exclusively from the app theme
 * (admin/internal/theme/css).
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle as ColorThemeToggle } from "@/components/shared/ThemeToggle";
import { ThemeToggle as DarkModeToggle } from "@/components/layout/theme-toggle";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { UserMenu } from "@/components/auth/ui/user-menu";
import { manageNavLinks, primaryNavLinks, type NavLink } from "@/lib/nav-links";
import type { NotificationPanel } from "@/features/notifications";

function NavItem({
  link,
  active,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  onNavigate?: () => void;
}) {
  const base =
    "flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium uppercase tracking-[0.14em]";
  if (link.comingSoon) {
    return (
      <span className={`${base} cursor-default text-muted-foreground/50`} aria-disabled>
        {link.label}
        <span className="rounded border border-border px-1 py-px text-[9px] tracking-wide text-muted-foreground/70">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={`${base} ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      {link.label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const isActive = (href: string) => pathname.startsWith(href);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-4">
        <Logo />
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Credit Card Manager
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4" data-testid="primary-nav">
        {primaryNavLinks.map((link) => (
          <NavItem key={link.label} link={link} active={isActive(link.href)} onNavigate={onNavigate} />
        ))}
        <p className="px-3 pb-1 pt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
          Manage
        </p>
        {manageNavLinks.map((link) => (
          <NavItem key={link.label} link={link} active={isActive(link.href)} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="border-t border-border px-3 py-3">
        <span
          className="flex w-full cursor-default items-center justify-center gap-2 rounded-md border border-primary/40 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-primary/60"
          aria-disabled
          title="Add card arrives with the onboarding flow (Phase 2)"
        >
          + Add Card
          <span className="rounded border border-border px-1 py-px text-[9px] text-muted-foreground/70">
            Soon
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Appearance
        </span>
        <span className="flex items-center gap-1">
          <ColorThemeToggle />
          <DarkModeToggle />
        </span>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  notificationPanel,
}: {
  children: React.ReactNode;
  notificationPanel: NotificationPanel;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card">
            <div className="flex justify-end px-3 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar — the mockup's primary chrome */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-card md:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="hidden md:block" />
          <div className="flex items-center gap-1">
            <NotificationMenu panel={notificationPanel} />
            <UserMenu />
          </div>
        </div>
        <main className="flex-1">
          <div className="px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
