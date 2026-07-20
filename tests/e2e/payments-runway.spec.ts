/**
 * Payment Runway page (issue #44) — read-only conformance against the
 * seed fixture. Assertions are DATE-INDEPENDENT by design: due/close
 * days recur monthly so every 45-day window holds them, but the
 * fixture's SCHEDULED payments are pinned to the dataset's 2026-07-11
 * anchor and age out of the window — scheduled-chip behavior lives in
 * reschedule-payment.spec.ts, which inserts its own row. Seed shape:
 * 15 cards carry a due day (3 of those also a close day), 3 cards have
 * neither → 15 lanes + a 3-card quiet tally, always.
 */
import { expect, test } from "@playwright/test"

test.describe("Payment Runway (issue #44)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/payments")
  })

  test("headline totals the window and the lane board renders", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText("needed before")

    const lanes = page.getByTestId("runway-lane")
    await expect(lanes).toHaveCount(15)
    await expect(page.getByTestId("runway-board")).toContainText(
      "3 cards with no activity in this window"
    )

    // Every due-day card plots at least one due occurrence in the window.
    const dueChips = page.locator('[data-testid="runway-event"][data-kind="due"]')
    expect(await dueChips.count()).toBeGreaterThanOrEqual(15)

    // Lane labels carry balance · utilization, never keyed by last-four.
    await expect(lanes.first().locator("p").nth(1)).toContainText("$")
  })

  test("by-due / by-close toggle flips chip emphasis", async ({ page }) => {
    const toggle = page.getByTestId("runway-toggle")
    const byDue = toggle.getByRole("button", { name: "By due date" })
    const byClose = toggle.getByRole("button", { name: "By statement close" })
    await expect(byDue).toHaveAttribute("aria-pressed", "true")

    const closeChip = page.locator('[data-testid="runway-event"][data-kind="close"]').first()
    const dueChip = page.locator('[data-testid="runway-event"][data-kind="due"]').first()
    await expect(closeChip).toHaveAttribute("data-dimmed", "true")
    await expect(dueChip).toHaveAttribute("data-dimmed", "false")

    await byClose.click()
    await expect(byClose).toHaveAttribute("aria-pressed", "true")
    await expect(byDue).toHaveAttribute("aria-pressed", "false")
    await expect(closeChip).toHaveAttribute("data-dimmed", "false")
    await expect(dueChip).toHaveAttribute("data-dimmed", "true")
  })

  test("cash-needed chart renders one bar per week with the total disclosed", async ({ page }) => {
    // ceil(45 / 7) = 7 weekly buckets.
    await expect(page.getByTestId("cash-week-bar")).toHaveCount(7)
    await expect(page.getByText("scheduled payments plus remaining minimums")).toBeVisible()
  })

  test("payoff plan projects a debt-free date and swaps strategy", async ({ page }) => {
    const readout = page.getByTestId("payoff-readout")
    await expect(readout).toContainText("Debt-free")

    await page.getByTestId("payoff-strategy-snowball").click()
    await expect(page.getByTestId("payoff-strategy-snowball")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(readout).toContainText("Debt-free")

    // No budget → no projection, an honest prompt instead.
    await page.getByTestId("payoff-budget").fill("")
    await expect(page.getByText("Enter a monthly budget")).toBeVisible()
  })

  test("reschedule panel teaches the interaction when idle", async ({ page }) => {
    await expect(page.getByTestId("reschedule-panel")).toContainText("Drag a payment chip")
  })

  test("sidebar Payments entry navigates here", async ({ page }) => {
    await page.goto("/overview")
    await page.getByTestId("primary-nav").getByRole("link", { name: "Payments" }).click()
    await expect(page).toHaveURL(/\/payments$/)
    await expect(page.getByTestId("runway-board")).toBeVisible()
  })
})
