/**
 * Empty / first-run states (issue #29, Gap G5) — runs as the card-less fixture
 * user (empty.json). Asserts the designed welcome renders instead of a zeroed
 * dashboard, and that no sparse artifacts ($0.00 / ~$0.00 / "across 0 cards" /
 * "1–0 of 0") leak. Read-only + isolated user: no count assertions on the demo
 * fixture, no cleanup.
 */
import { expect, test } from "@playwright/test"

test.describe("Overview first-run (card-less user)", () => {
  test("shows the welcome + add-card CTA, not a zeroed dashboard", async ({ page }) => {
    await page.goto("/overview")

    // The first-run state carries the Syne <h1> (theme-and-shell parity).
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("button", { name: /add your first card/i })).toBeVisible()

    // No leak of the demo fixture's totals, and no sparse artifacts.
    await expect(page.getByText("$43,969.72")).toHaveCount(0)
    await expect(page.getByText("$0.00")).toHaveCount(0)
    await expect(page.getByText("~$0.00")).toHaveCount(0)
    await expect(page.getByText("across 0 cards")).toHaveCount(0)
  })
})

test.describe("Cards empty state (card-less user)", () => {
  test("shows the empty state, no rows, and no 1–0 of 0 footer", async ({ page }) => {
    await page.goto("/cards")

    await expect(page.getByRole("heading", { name: "Cards", exact: true })).toBeVisible()
    await expect(page.getByText("No cards yet")).toBeVisible()
    await expect(page.getByRole("button", { name: /add a card/i })).toBeVisible()

    await expect(page.getByTestId("card-row")).toHaveCount(0)
    await expect(page.getByText("1–0 of 0")).toHaveCount(0)
    await expect(page.getByText("$0.00")).toHaveCount(0)
  })
})
