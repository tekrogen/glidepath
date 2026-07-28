/**
 * Plaid discovered-cards + suggestions surfaces (issue #109) — read-only,
 * seed-exact. CI has no Plaid credentials and the seed carries no
 * PlaidItem/PlaidAccount rows, so these specs pin the graceful-degradation
 * states: the Connected-banks tab renders its empty discovery state, the
 * ?source=plaid deep-link selects it, and the seeded /cards page carries no
 * provider-suggestions panel.
 */
import { expect, test } from "@playwright/test"

test("import page carries the Connected banks tab; deep-link selects it", async ({ page }) => {
  await page.goto("/cards/import?source=plaid")

  const plaidTab = page.getByRole("tab", { name: "Connected banks" })
  await expect(plaidTab).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tab", { name: "Tracker workbook" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Monarch balances" })).toBeVisible()

  // Seed has no Plaid connections — the discovery empty state, not a table.
  await expect(page.getByRole("heading", { name: "No cards to discover" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Manage connections" })).toHaveAttribute(
    "href",
    "/settings"
  )
})

test("default tab is still the tracker workbook", async ({ page }) => {
  await page.goto("/cards/import")
  await expect(page.getByRole("tab", { name: "Tracker workbook" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
})

test("seeded cards page has no provider-suggestions panel", async ({ page }) => {
  await page.goto("/cards")
  await expect(page.getByRole("heading", { name: "Cards", exact: true })).toBeVisible()
  await expect(page.getByTestId("provider-suggestions")).toHaveCount(0)
})
