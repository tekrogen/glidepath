"use client";

import { Palette } from "lucide-react";
import { useColorTheme, useThemeMounted } from "@/components/providers/ThemeProvider";
import { themes, themeOptions } from "@/lib/themes";

interface ThemeToggleProps {
  /** Show label text next to icon */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Toggle button for switching between themes
 */
export function ThemeToggle({ showLabel = false, className = "" }: ThemeToggleProps) {
  const { colorTheme: theme, toggleColorTheme: toggleTheme } = useColorTheme();
  const mounted = useThemeMounted();

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className={`p-2 rounded-md hover:bg-muted transition-colors ${className}`}
        disabled
        aria-label="Loading theme..."
      >
        <Palette className="w-5 h-5 text-muted-foreground" />
      </button>
    );
  }

  const currentTheme = themes[theme];
  
  // Cycle through all available themes using themeOptions for consistent ordering
  const currentIndex = themeOptions.findIndex((opt) => opt.value === theme);
  const nextIndex = (currentIndex + 1) % themeOptions.length;
  const nextTheme = themeOptions[nextIndex].value;
  const nextThemeName = themes[nextTheme].name;

  const handleColorThemeToggle = () => {
    toggleTheme();
  };

  return (
    <button
      onClick={handleColorThemeToggle}
      className={`p-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2 ${className}`}
      title={`Switch color theme to ${nextThemeName} (currently ${currentTheme.name})`}
      aria-label={`Current color theme: ${currentTheme.name}. Click to switch to ${nextThemeName}`}
    >
      <Palette className="w-5 h-5" />
      {showLabel && (
        <span className="text-sm">{currentTheme.name}</span>
      )}
    </button>
  );
}
