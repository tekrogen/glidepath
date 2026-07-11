"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle as ColorThemeToggle } from "@/components/shared/ThemeToggle";
import { ThemeToggle as DarkModeToggle } from "@/components/layout/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { headerNavLinks } from "@/lib/nav-links";
import { UserMenu } from "@/components/auth/ui/user-menu";

export function Navbar() {
    const pathname = usePathname();
    const { data: session, status } = useSession();

    const isLoading = status === "loading";
    const isAuthenticated = status === "authenticated" && session?.user;

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b glass">
            <div className="flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-8">
                        <Logo />
                        {/* Navigation — only shown when authenticated */}
                        {isAuthenticated && (
                            <nav className="hidden md:flex items-center gap-6">
                                {headerNavLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`text-sm font-medium transition-colors hover:text-primary whitespace-nowrap ${
                                            isActive(link.href)
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <ColorThemeToggle />
                        <DarkModeToggle />

                        {isLoading ? (
                            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                        ) : isAuthenticated ? (
                            <div className="hidden md:block">
                                <UserMenu compact />
                            </div>
                        ) : (
                            <div className="hidden md:flex items-center gap-2">
                                <Button variant="ghost" asChild>
                                    <Link href="/signin">Sign In</Link>
                                </Button>
                                <Button asChild>
                                    <Link href="/signin">Get Started</Link>
                                </Button>
                            </div>
                        )}
                        {/* Mobile Navigation */}
                        <MobileNav />
                    </div>
            </div>
        </header>
    );
}
