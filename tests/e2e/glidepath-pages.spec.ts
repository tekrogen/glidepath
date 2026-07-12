/**
 * Overview + Cards pages against the SEED_VERSION 2 dataset — the rendered
 * figures must match the Hi-Fi mockup exactly (Blueprint Level 11:
 * the seed is the fixture).
 */
import { expect, test } from "@playwright/test"

test.describe("Overview page", () => {
  test("renders the Hi-Fi metric tiles from seed", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
    await expect(page.getByText("$43,969.72")).toBeVisible() // total balance
    await expect(page.getByText("of $215,850.00 total limit across 18 cards")).toBeVisible()
    await expect(page.getByText("20.4%")).toBeVisible() // overall utilization
    await expect(page.getByText("$572.92")).toBeVisible() // min payments/mo
  })

  test("renders paydown priority and promo payoff panels", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText("Paydown Priority")).toBeVisible()
    await expect(page.getByText(/6 cards are at 30%\+ utilization/)).toBeVisible()
    await expect(page.getByText("Horizon Cash", { exact: true })).toBeVisible()
    await expect(page.getByText("0% Promo Payoff Plan")).toBeVisible()
    await expect(page.getByText(/5 cards are not on track at the current minimum/)).toBeVisible()
    await expect(page.getByText("$2,117.00/mo")).toBeVisible() // Cascade Platinum
  })

  test("what-if slider recomputes the Hi-Fi anchor", async ({ page }) => {
    await page.goto("/overview")
    const result = page.getByTestId("whatif-result")
    await expect(result).toContainText("Horizon Cash drops under 30%")
    await expect(result).toContainText("(11 payments)")
    await expect(result).toContainText("~$96.60/mo interest at 22.74%")
  })
})

test.describe("Cards page", () => {
  test("renders the paged portfolio table", async ({ page }) => {
    await page.goto("/cards")
    await expect(page.getByRole("heading", { name: "Cards" })).toBeVisible()
    await expect(page.getByTestId("card-row")).toHaveCount(10) // page 1 of 18
    await expect(page.getByText("Showing 1–10 of 18 active cards")).toBeVisible()
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(page.getByText("Showing 11–18 of 18 active cards")).toBeVisible()
  })

  test("shows canonical status badges and promo APR treatment", async ({ page }) => {
    await page.goto("/cards")
    await expect(page.getByText("High Utilization").first()).toBeVisible()
    await expect(page.getByText(/0% · \d+d/).first()).toBeVisible() // promo APR cell
    await expect(page.getByText(/····7727/).first()).toBeVisible()
  })
})

test.describe("Sign-in error feedback (issue #11)", () => {
  // Runs unauthenticated on purpose: a fresh context hits the signin page.
  test.use({ storageState: { cookies: [], origins: [] } })

  test("wrong password shows an inline error instead of failing silently", async ({ page }) => {
    await page.goto("/signin")
    await page.getByLabel("Email").fill("demo@glidepath.cards")
    await page.getByLabel("Password").fill("wrong-password")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText(/sign-in failed|invalid|incorrect|try again/i).first()).toBeVisible()
    await expect(page).toHaveURL(/signin/) // no silent redirect
  })

  test("demo autofill + submit reaches the dashboard", async ({ page }) => {
    await page.goto("/signin")
    await page.getByText("Fill in demo credentials").click()
    await expect(page.getByLabel("Email")).toHaveValue("demo@glidepath.cards")
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForURL(/dashboard|overview/)
  })
})
