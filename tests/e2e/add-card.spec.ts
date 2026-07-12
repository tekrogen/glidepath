/**
 * Add-card flow (issue #26): sidebar CTA → sheet → manual form → server
 * action → row on /cards.
 *
 * Runs in the `authenticated-mutations` Playwright project, which depends
 * on `authenticated` — mutation specs run strictly after the read-only
 * specs that assert the seed-exact fixture, so an in-flight test row can
 * never collide with an "18 cards" assertion.
 *
 * Hermeticity: the happy path inserts a REAL card row. The seed wipes
 * cards on db:seed, but a reused dev server never re-seeds, so this spec
 * (a) names its cards with the unique "E2E " prefix + timestamp,
 * (b) deletes them via scripts/delete-e2e-cards.ts before AND right after
 * the run, restoring the 18-card seed fixture other specs assert against,
 * and (c) never asserts on total counts. Serial: the tests share that
 * cleanup lifecycle.
 */
import { execSync } from "node:child_process"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })

function deleteE2eCards() {
  execSync("pnpm exec tsx scripts/delete-e2e-cards.ts", {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  })
}

test.beforeAll(deleteE2eCards)
test.afterAll(deleteE2eCards)

async function openAddCardSheet(page: Page) {
  await page.goto("/overview")
  await page.getByRole("button", { name: "+ Add Card" }).click()
  await expect(page.getByRole("heading", { name: "Add card" })).toBeVisible()
}

test("sidebar CTA is a real button (no disabled span) and empty submit surfaces field errors", async ({
  page,
}) => {
  await page.goto("/overview")
  await expect(page.locator('span[aria-disabled]', { hasText: "+ Add Card" })).toHaveCount(0)

  await openAddCardSheet(page)
  await page.getByRole("button", { name: "Add card", exact: true }).click()

  await expect(page.getByText("Give the card a name.")).toBeVisible()
  await expect(page.getByText("Enter the issuer.")).toBeVisible()
  const banner = page.getByRole("alert")
  await expect(banner).toContainText("Check the highlighted fields.")
  await expect(banner).toBeFocused()
})

test("failed submit preserves the typed values (React 19 form-reset guard)", async ({ page }) => {
  await openAddCardSheet(page)
  // Valid name, but a bad last-four → validation fails on lastFour only.
  await page.getByLabel("Card name *").fill("E2E Kept Name")
  await page.getByLabel("Issuer *").fill("E2E Bank")
  await page.getByLabel("Last 4 digits").fill("12ab")
  await page.getByRole("button", { name: "Add card", exact: true }).click()

  await expect(page.getByText("Only the last 4 digits — never the full card number.")).toBeVisible()
  // The typed text must survive the action round-trip.
  await expect(page.getByLabel("Card name *")).toHaveValue("E2E Kept Name")
  await expect(page.getByLabel("Issuer *")).toHaveValue("E2E Bank")
})

test("promo switch requires an end date", async ({ page }) => {
  await openAddCardSheet(page)
  await page.getByLabel("Card name *").fill("E2E Promo Card")
  await page.getByLabel("Issuer *").fill("E2E Bank")
  await page.getByRole("switch", { name: "0% intro APR active" }).click()
  await expect(page.getByLabel("0% APR end date")).toBeVisible()
  await expect(page.getByLabel(/Regular APR \(%\) after promo/)).toBeVisible()

  await page.getByRole("button", { name: "Add card", exact: true }).click()
  await expect(page.getByText("Enter when the 0% promo ends.")).toBeVisible()
})

test("minimal manual card lands in the cards table", async ({ page }) => {
  const cardName = `E2E Test Card ${Date.now()}`

  await openAddCardSheet(page)
  await page.getByLabel("Card name *").fill(cardName)
  await page.getByLabel("Issuer *").fill("E2E Bank")
  await page.getByRole("button", { name: "Add card", exact: true }).click()

  // Server-confirmed success: toast names the card, sheet closes.
  await expect(page.getByText(`${cardName} added.`)).toBeVisible()
  await expect(page.getByRole("heading", { name: "Add card" })).toBeHidden()

  // The new row is on /cards — page through (default sort sinks the
  // limitless newcomer to the end; never assert totals).
  await page.goto("/cards")
  await expect(page.getByRole("heading", { name: "Cards" })).toBeVisible()
  for (;;) {
    if ((await page.getByTestId("card-row").filter({ hasText: cardName }).count()) > 0) break
    const next = page.getByRole("button", { name: "Next", exact: true })
    expect(await next.isEnabled(), `row "${cardName}" not found on any page`).toBe(true)
    await next.click()
  }
  await expect(page.getByTestId("card-row").filter({ hasText: cardName })).toBeVisible()

  // Clean up immediately — other specs assert the 18-card seed fixture.
  deleteE2eCards()
})

test("promo card lands with the 0% APR treatment on its row", async ({ page }) => {
  const cardName = `E2E Promo Card ${Date.now()}`
  // A year out so daysUntil stays comfortably positive → "0% · Nd" display.
  const nextYear = new Date()
  nextYear.setFullYear(nextYear.getFullYear() + 1)
  const endsOn = nextYear.toISOString().slice(0, 10)

  await openAddCardSheet(page)
  await page.getByLabel("Card name *").fill(cardName)
  await page.getByLabel("Issuer *").fill("E2E Bank")
  await page.getByRole("switch", { name: "0% intro APR active" }).click()
  await page.getByLabel("0% APR end date").fill(endsOn)
  await page.getByLabel(/Regular APR \(%\) after promo/).fill("22.74")
  await page.getByRole("button", { name: "Add card", exact: true }).click()

  await expect(page.getByText(`${cardName} added.`)).toBeVisible()

  await page.goto("/cards")
  await expect(page.getByRole("heading", { name: "Cards" })).toBeVisible()
  let row = page.getByTestId("card-row").filter({ hasText: cardName })
  for (;;) {
    if ((await row.count()) > 0) break
    const next = page.getByRole("button", { name: "Next", exact: true })
    expect(await next.isEnabled(), `row "${cardName}" not found on any page`).toBe(true)
    await next.click()
    row = page.getByTestId("card-row").filter({ hasText: cardName })
  }
  // Promo APR treatment: "0% · Nd" (never a card-level percentage).
  await expect(row.getByText(/0% · \d+d/)).toBeVisible()

  deleteE2eCards()
})

test("secondary path links to the institution flow", async ({ page }) => {
  await openAddCardSheet(page)
  await expect(
    page.getByText("Link with your bank — balances and limits sync automatically")
  ).toBeVisible()
  await page.getByRole("button", { name: "Link an institution" }).click()
  await expect(page).toHaveURL(/\/connect-account/)
})
