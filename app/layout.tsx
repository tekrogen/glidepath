import type { Metadata } from "next";
import { Syne, Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Script to prevent flash of wrong theme on initial load.
// Handles both the color theme (data-theme attribute) and dark/light mode.
// NOTE: validThemes must match lib/themes.ts — update both when adding themes.
const themeInitScript = `
  (function() {
    try {
      var validThemes = ['blue', 'orange', 'midnight'];
      var colorTheme = localStorage.getItem('ccm-color-theme');

      if (colorTheme && validThemes.indexOf(colorTheme) !== -1) {
        document.documentElement.setAttribute('data-theme', colorTheme);
      }

      // Dark/light mode (handled by next-themes, but detect system preference early)
      var theme = localStorage.getItem('theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {
      console.warn('[CardManager] Failed to restore theme from localStorage:', e);
    }
  })();
`;

export const metadata: Metadata = {
  title: "Credit Card Manager",
  description:
    "Connect your credit cards with Plaid and get a clear picture of balances, transactions, and spending.",
};

// Viewport configuration for iOS (Next.js 16+ requires separate export)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${syne.variable} ${inter.variable} font-sans antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
