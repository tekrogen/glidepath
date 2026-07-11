"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, CreditCard } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { headerNavLinks } from "@/lib/nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAuthenticated = status === "authenticated" && session?.user;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = () => {
    setOpen(false);
    signOut({ callbackUrl: "/" });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>
            <Link href="/" className="flex items-center space-x-2" onClick={() => setOpen(false)}>
              <CreditCard className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Credit Card Manager</span>
            </Link>
          </SheetTitle>
        </SheetHeader>

        {/* User Info (when authenticated) */}
        {isAuthenticated && (
          <div className="mt-6 flex items-center gap-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <Avatar className="h-10 w-10">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ""} />
              <AvatarFallback>{getInitials(session.user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{session.user.name || "User"}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session.user.email}
              </p>
            </div>
            <RoleBadge role={session.user.role} />
          </div>
        )}

        <nav className="mt-6 flex flex-col gap-4">
          {/* App nav links — shown to all authenticated users with active highlighting */}
          {isAuthenticated && (
            <>
              {headerNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`text-lg font-medium transition-colors hover:text-foreground ${
                    isActive(link.href)
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </>
          )}

          {/* Auth buttons */}
          <div className="mt-4 flex flex-col gap-2">
            {isAuthenticated ? (
              <Button variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/signin" onClick={() => setOpen(false)}>Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/signin" onClick={() => setOpen(false)}>Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
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
