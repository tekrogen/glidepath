/**
 * Attention feed + persisted notifications (issue #25) against the
 * SEED_VERSION 2 dataset: the seed's high-utilization cards guarantee
 * attention items, and the write-on-read sync persists them for the bell.
 */
import { execSync } from "node:child_process"
import path from "node:path"

import { expect, test } from "@playwright/test"

// Serial + explicit reset: mark-read/dismiss mutate shared per-user state,
// and dismissed-while-active rows persist across runs by design (occurrence
// lifecycle) — the reset keeps reruns against a reused dev server hermetic.
test.describe.configure({ mode: "serial" })

test.beforeAll(() => {
  execSync("pnpm exec tsx scripts/reset-demo-notifications.ts", {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  })
})

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

    // Open the panel — the seeded attention items are listed.
    await bell.click()
    const rows = page.getByTestId("notification-row")
    await expect(rows.first()).toBeVisible()

    // Activating an unread row marks it read, closes the panel, and follows
    // the item's href; the unread count decreases.
    const unreadRow = page.locator('[data-testid="notification-row"][data-read="false"]').first()
    await unreadRow.locator("button").first().click()
    await expect(page).toHaveURL(/\/cards/)
    await expect(
      page.getByRole("button", { name: `Notifications (${unread - 1} unread)` })
    ).toBeVisible()

    // Dismissing a row removes it from the list (panel stays open).
    await page.getByRole("button", { name: /Notifications \(\d+ unread\)/ }).click()
    await expect(rows.first()).toBeVisible()
    const dismissId = await rows.first().getAttribute("data-id")
    await rows.first().getByRole("button", { name: /^Dismiss:/ }).click()
    await expect(page.locator(`[data-testid="notification-row"][data-id="${dismissId}"]`)).toHaveCount(0)
  })
})
