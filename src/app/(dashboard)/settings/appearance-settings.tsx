"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ThemeSelector } from "@/components/shared/ThemeSelector";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useThemeMounted } from "@/components/providers/ThemeProvider";

export function AppearanceSettings() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useThemeMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Color Theme</div>
          <div className="text-sm text-muted-foreground">
            Choose the color palette used across the app
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSelector showLabel />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Dark Mode</div>
          <div className="text-sm text-muted-foreground">
            Switch between light and dark appearance
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            disabled={!mounted}
            aria-label="Toggle dark mode"
          />
          <Moon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
