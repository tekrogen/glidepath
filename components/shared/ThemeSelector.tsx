"use client";

import { Palette } from "lucide-react";
import { useColorTheme, useThemeMounted } from "@/components/providers/ThemeProvider";
import { themes, themeOptions, type ThemeName } from "@/lib/themes";

interface ThemeSelectorProps {
  /** Show label text next to icon */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Display mode: 'dropdown' for dropdown menu, 'grid' for grid of options */
  displayMode?: "dropdown" | "grid";
  /** Callback when theme changes */
  onThemeChange?: (theme: ThemeName) => void;
}

/**
 * Theme selector component for choosing between available color themes
 * Can be displayed as a dropdown or grid of options
 */
export function ThemeSelector({
  showLabel = false,
  className = "",
  displayMode = "dropdown",
  onThemeChange,
}: ThemeSelectorProps) {
  const { colorTheme: currentTheme, setColorTheme } = useColorTheme();
  const mounted = useThemeMounted();

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Palette className="w-5 h-5 text-muted-foreground" />
        {showLabel && <span className="text-sm text-muted-foreground">Loading...</span>}
      </div>
    );
  }

  const handleThemeChange = (theme: ThemeName) => {
    setColorTheme(theme);
    onThemeChange?.(theme);
  };

  if (displayMode === "grid") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium">Color Theme</label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {themeOptions.map((option) => {
            const isSelected = currentTheme === option.value;
            const themeColors = themes[option.value].colors;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                aria-label={`Select ${option.label} theme`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-6 h-6 rounded-full border border-border/50"
                    style={{ backgroundColor: themeColors.primary }}
                    title="Primary color"
                  />
                  <div
                    className="w-6 h-6 rounded-full border border-border/50"
                    style={{ backgroundColor: themeColors.accent }}
                    title="Accent color"
                  />
                </div>
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Changes apply immediately and are saved automatically
        </p>
      </div>
    );
  }

  // Dropdown mode - simple select dropdown
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Palette className="w-5 h-5" />
      {showLabel && <span className="text-sm font-medium">Theme:</span>}
      <select
        value={currentTheme}
        onChange={(e) => handleThemeChange(e.target.value as ThemeName)}
        className="px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        aria-label="Select color theme"
      >
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
