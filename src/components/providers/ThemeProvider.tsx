"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeName } from "@/lib/themes";
import { DEFAULT_THEME, themes, themeOptions } from "@/lib/themes";

interface ColorThemeContextValue {
  /** Current active color theme */
  colorTheme: ThemeName;
  /** Set the active color theme */
  setColorTheme: (theme: ThemeName) => void;
  /** Toggle between color themes */
  toggleColorTheme: () => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

const COLOR_THEME_STORAGE_KEY = "ccm-color-theme";

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default color theme if none is stored */
  defaultColorTheme?: ThemeName;
}

export function ThemeProvider({
  children,
  defaultColorTheme = DEFAULT_THEME
}: ThemeProviderProps) {
  const [colorTheme, setColorThemeState] = useState<ThemeName>(defaultColorTheme);
  const [mounted, setMounted] = useState(false);

  // Load color theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
      // Validate against all available themes
      if (stored && stored in themes) {
        setColorThemeState(stored as ThemeName);
      }
    } catch {
      // localStorage not available (SSR or private browsing)
    }
  }, []);

  // Apply color theme to document and persist
  useEffect(() => {
    if (!mounted) return;

    document.documentElement.setAttribute("data-theme", colorTheme);

    try {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    } catch {
      // localStorage not available
    }
  }, [colorTheme, mounted]);

  const setColorTheme = useCallback((newTheme: ThemeName) => {
    setColorThemeState(newTheme);
  }, []);

  const toggleColorTheme = useCallback(() => {
    setColorThemeState((current) => {
      // Cycle through available themes
      const currentIndex = themeOptions.findIndex((opt) => opt.value === current);
      const nextIndex = (currentIndex + 1) % themeOptions.length;
      return themeOptions[nextIndex].value;
    });
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeContext.Provider value={{ colorTheme, setColorTheme, toggleColorTheme }}>
        {children}
      </ColorThemeContext.Provider>
    </NextThemesProvider>
  );
}

/**
 * Hook to access the color theme context.
 * For dark/light mode, use useTheme from 'next-themes'
 * @throws Error if used outside ThemeProvider
 */
export function useColorTheme(): ColorThemeContextValue {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error("useColorTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Hook to check if theme is loaded (client-side only)
 * Useful for preventing hydration mismatches
 */
export function useThemeMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
