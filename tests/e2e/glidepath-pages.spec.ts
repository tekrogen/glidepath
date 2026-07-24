/**
 * Overview + Cards pages against the SEED_VERSION 2 dataset — the rendered
 * figures must match the Hi-Fi mockup exactly (Blueprint Level 11:
 * the seed is the fixture).
 */
import { expect, test } from "@playwright/test"

import { SEED_CARDS } from "../../prisma/seed-data/glidepath-cards"

const usd = (minor: bigint) =>
  (Number(minor) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })

test.describe("Overview page", () => {
  test("v2 header: hero total balance is the h1, with a utilization chip", async ({ page }) => {
    await page.goto("/overview")
    // The hero total balance is the page's <h1> (was h3 in the mockup).
    await expect(page.locator("h1")).toHaveText("$43,969.72")
    await expect(page.getByText("20.4% · OK")).toBeVisible() // overall utilization chip
  })

  test("renders the Hi-Fi metric tiles from seed", async ({ page }) => {
    await page.goto("/overview")
    // Total balance + utilization live in the hero now; the grid carries the
    // complementary tiles only (available credit / 0% sheltered, min payments).
    await expect(page.getByText(/of balance sheltered at 0% APR across 6 cards/)).toBeVisible()
    await expect(page.getByText("$572.92")).toBeVisible() // min payments/mo
  })

  test("card rack renders tiles with badges and a view-all link when capped", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText(/Card rack/)).toBeVisible()
    await expect(page.getByTestId("rack-tile")).toHaveCount(6) // 18 cards, capped at 6
    // Rack badges use the compact label ("High"); the table keeps "High Utilization".
    await expect(page.getByText("High", { exact: true }).first()).toBeVisible() // status badge
    const viewAll = page.getByRole("link", { name: /more cards · View all 18 cards/ })
    await expect(viewAll).toBeVisible()
    await expect(viewAll).toHaveAttribute("href", "/cards")
  })

  test("upcoming payments: real rows, ordered, no-due-day cards excluded", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText("Upcoming payments")).toBeVisible()
    const rows = page.getByTestId("upcoming-payment")
    await expect(rows.first()).toBeVisible()
    // Card→amount pairing against the fixture, DATE-INDEPENDENTLY: which six
    // cards are "next due" rotates with the calendar (a pinned "Meridian ·
    // $85.00" row aged out of the visible cap and failed — 2026-07-24), so
    // assert the FIRST row's amount matches ITS card's recorded minimum.
    const firstName = (await rows.first().locator("p").first().textContent())?.trim()
    const seedCard = SEED_CARDS.find((c) => c.cardName === firstName)
    expect(seedCard, `first upcoming row "${firstName}" must be a seed card`).toBeDefined()
    await expect(rows.first()).toContainText(
      seedCard!.minimumPaymentMinor == null ? "Min not set" : usd(seedCard!.minimumPaymentMinor)
    )
    // A card with no due day (Cedar Line) never appears.
    await expect(rows.filter({ hasText: "Cedar Line" })).toHaveCount(0)
    // Ordering is ascending by due date — assert structurally, not by fixed date.
    const dateTexts = await rows.evaluateAll((els) =>
      els.map((el) => el.querySelector("span")!.textContent!.trim())
    )
    const toTime = (s: string) => new Date(s.replace(/'(\d\d)$/, "20$1")).getTime()
    for (let i = 1; i < dateTexts.length; i++) {
      expect(toTime(dateTexts[i])).toBeGreaterThanOrEqual(toTime(dateTexts[i - 1]))
    }
  })

  test("transactions + spend-donut show their placeholder copy", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText("Transactions · all cards")).toBeVisible()
    await expect(
      page.getByText("Transactions appear here once your cards have activity.")
    ).toBeVisible()
    await expect(page.getByText("Spend by category")).toBeVisible()
    await expect(page.getByText("Arrives with Insights.")).toBeVisible()
  })

  test("renders paydown priority and promo payoff panels", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText("Paydown Priority")).toBeVisible()
    await expect(page.getByText(/6 cards are at 30%\+ utilization/)).toBeVisible()
    await expect(page.getByText("Horizon Cash", { exact: true }).first()).toBeVisible()
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
    await page.waitForURL(/overview/)
  })
})
