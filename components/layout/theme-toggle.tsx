"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Dark/Light Mode Toggle Component
 *
 * This component toggles between light and dark mode using next-themes.
 * It is separate from the color theme toggle.
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine next theme for aria-label
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const currentThemeLabel = resolvedTheme === "dark" ? "dark" : "light";

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Loading dark mode toggle...">
        <Sun className="h-5 w-5" />
        <span className="sr-only">Toggle dark mode</span>
      </Button>
    );
  }

  const handleToggle = () => {
    const newTheme: "light" | "dark" = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      title={`Switch to ${nextTheme} mode (currently ${currentThemeLabel})`}
      aria-label={`Current mode: ${currentThemeLabel}. Click to switch to ${nextTheme} mode`}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle dark mode</span>
    </Button>
  );
}
