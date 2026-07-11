"use client";

/**
 * User Menu Component
 *
 * Dropdown menu showing user info and actions when authenticated.
 * Shows sign-in button when not authenticated.
 */

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronDown,
  CreditCard,
  Home,
  Landmark,
  LogOut,
  PieChart,
  Settings,
  TrendingUp,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { headerNavLinks } from "@/lib/nav-links";

/** Simple role check — roles are USER and ADMIN only */
export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

/** Icon map for navigation links in the dropdown */
const navIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": Home,
  "/accounts": Landmark,
  "/transactions": CreditCard,
  "/analytics": TrendingUp,
  "/budgets": PieChart,
  "/recurring": CalendarClock,
  "/settings": Settings,
};

interface UserMenuProps {
  /**
   * Show compact version (just avatar, no text)
   */
  compact?: boolean;
}

export function UserMenu({ compact = false }: UserMenuProps) {
  const { data: session, status } = useSession();

  // Loading state
  if (status === "loading") {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
    );
  }

  // Not authenticated
  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/signin">Sign In</Link>
        </Button>
        <Button asChild>
          <Link href="/signin">Get Started</Link>
        </Button>
      </div>
    );
  }

  const { user } = session;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-auto gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <div className="hidden flex-col items-start text-left sm:flex">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {user.name || "User"}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </span>
            </div>
          )}
          {!compact && <ChevronDown className="h-4 w-4 text-slate-500" />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
            <div className="pt-1">
              <RoleBadge role={user.role} />
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Navigation — shown to all authenticated users */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Navigation
        </DropdownMenuLabel>
        {headerNavLinks.map((link) => {
          const Icon = navIconMap[link.href] || Home;
          return (
            <DropdownMenuItem key={link.href} asChild>
              <Link href={link.href} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Preferences — always available */}
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <div>
              <span>Settings</span>
              <span className="block text-xs text-muted-foreground">Theme, notifications</span>
            </div>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2 text-red-600 dark:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const colors: Record<UserRole, string> = {
    USER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Badge className={`text-xs ${colors[role]}`}>
      {role}
    </Badge>
  );
}
