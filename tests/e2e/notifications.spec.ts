/**
 * Attention feed + persisted notifications (issue #25) against the
 * SEED_VERSION 2 dataset: the seed's high-utilization cards guarantee
 * attention items, and the write-on-read sync persists them for the bell.
 */
import { expect, test } from "@playwright/test"

test.describe("Overview attention feed", () => {
  test("renders the attention panel with seeded items", async ({ page }) => {
    await page.goto("/overview")
    await expect(page.getByText("Needs Attention")).toBeVisible()
    // Seed has 6 high-utilization cards, so at least one item always renders.
    expect(await page.getByTestId("attention-item").count()).toBeGreaterThan(0)
    await expect(page.getByText("High utilization").first()).toBeVisible()
  })
})

test.describe("Notification bell", () => {
  test("mark-read decrements the unread count and dismiss removes the row", async ({ page }) => {
    await page.goto("/overview")

    const bell = page.getByRole("button", { name: /Notifications \(\d+ unread\)/ })
    await expect(bell).toBeVisible()
    const unread = Number((await bell.getAttribute("aria-label"))!.match(/\((\d+) unread\)/)![1])
    expect(unread).toBeGreaterThan(0)

    // Open the menu — the seeded attention items are listed.
    await bell.click()
    const rows = page.getByTestId("notification-row")
    await expect(rows.first()).toBeVisible()

    // Clicking an unread row marks it read → the unread count decreases.
    // (While the menu is open the trigger is aria-hidden, so assert the
    // count via the open menu's accessible name — it is labelled by the trigger.)
    const unreadRow = page.locator('[data-testid="notification-row"][data-read="false"]').first()
    await unreadRow.locator("button").first().click()
    await expect(
      page.getByRole("menu", { name: `Notifications (${unread - 1} unread)` })
    ).toBeVisible()

    // Dismissing a row removes it from the list.
    const dismissId = await rows.first().getAttribute("data-id")
    await rows.first().getByRole("button", { name: /^Dismiss:/ }).click()
    await expect(page.locator(`[data-testid="notification-row"][data-id="${dismissId}"]`)).toHaveCount(0)
  })
})
