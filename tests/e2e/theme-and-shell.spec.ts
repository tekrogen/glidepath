/**
 * Theme + shell conformance (EDR-013):
 * - Colors/styles come from admin/internal/theme/css — these tests assert
 *   the LIVE computed tokens against the canonical values in that file,
 *   in both light and dark modes, plus the theme's fonts (Inter body,
 *   Syne headings).
 * - UIUX architecture comes from the mockup — the sidebar must carry its
 *   IA: Overview → Cards → Payment Runway → Swipe Matrix → Wallet, then
 *   the Manage group.
 */
import { expect, test, type Page } from "@playwright/test"

/** Canonical values from admin/internal/theme/css/styles.css (:root / .dark). */
const LIGHT = {
  "--background": "0 0% 100%",
  "--foreground": "210 20% 15%",
  "--primary": "201 35% 40%", // brand blue #446e88
  "--secondary": "181 86% 39%", // brand cyan #0db4b9
  "--accent": "147 56% 67%", // brand mint #7edba5
  "--radius": ".5rem", // browsers serialize 0.5rem → .5rem
}
const DARK = {
  "--background": "220 20% 8%",
  "--foreground": "0 0% 95%",
  "--card": "220 20% 10%",
  "--primary": "201 45% 55%",
  "--secondary": "181 80% 45%",
}

async function readTokens(page: Page, names: string[]) {
  return page.evaluate((tokens) => {
    const cs = getComputedStyle(document.documentElement)
    return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]))
  }, names)
}

test.describe("Theme tokens (canonical css)", () => {
  test("light mode serves the wealth-palette tokens verbatim", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/overview")
    const tokens = await readTokens(page, Object.keys(LIGHT))
    expect(tokens).toEqual(LIGHT)
  })

  test("dark mode serves the canonical .dark tokens verbatim", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/overview")
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(true)
    const tokens = await readTokens(page, Object.keys(DARK))
    expect(tokens).toEqual(DARK)
  })

  test("theme fonts: Inter body, Syne headings", async ({ page }) => {
    await page.goto("/overview")
    const fonts = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
    }))
    expect(fonts.body).toContain("Inter")
    expect(fonts.h1).toContain("Syne")
  })
})

test.describe("Shell architecture (mockup IA)", () => {
  test("sidebar carries the mockup navigation order", async ({ page }) => {
    await page.goto("/overview")
    const nav = page.getByTestId("primary-nav")
    const labels = await nav
      .locator("a, span[aria-disabled]")
      .evaluateAll((els) => els.map((e) => e.textContent?.replace(/Soon$/, "").trim()))
    expect(labels.slice(0, 5)).toEqual([
      "Overview",
      "Cards",
      "Payment Runway",
      "Swipe Matrix",
      "Wallet",
    ])
    expect(labels).toContain("Transactions")
    expect(labels).toContain("Settings")
  })

  test("brand lives in the sidebar; coming-soon surfaces are not navigable", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText("Glidepath")).toBeVisible()
    await expect(page.getByText("Credit Card Manager", { exact: true })).toBeVisible()
    const runway = page.getByTestId("primary-nav").getByText("Payment Runway")
    await expect(runway).toBeVisible()
    expect(await runway.evaluate((el) => el.closest("a") != null)).toBe(false)
  })
})
