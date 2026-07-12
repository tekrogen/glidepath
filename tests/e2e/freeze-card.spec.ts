/**
 * Freeze/unfreeze flow (issue #27): Cards-table row action → popover confirm
 * (EDR-007 disclosure) → optimistic FROZEN badge → audited mutation, and the
 * inverse. Also guards the blueprint rule that FROZEN cards KEEP surfacing
 * attention items (lifecycle outranks the badge, not the feed).
 *
 * Runs in the `authenticated-mutations` Playwright project (after the
 * read-only specs that assert the seed-exact fixture). Hermeticity: the spec
 * flips a real card's lifecycle; the seed sets every card ACTIVE, but a
 * reused dev server never re-seeds — so it resets lifecycles to ACTIVE via
 * scripts/reset-card-lifecycle.ts before AND after the run. Serial: the tests
 * share that cleanup lifecycle. Target is selected by NAME, never last-four
 * (Horizon Cash ····7727 is a deliberate duplicate).
 */
import { execSync } from "node:child_process"
import path from "node:path"

import { expect, test, type Locator, type Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })

const CARD = "Horizon Cash"

function resetLifecycles() {
  execSync("pnpm exec tsx scripts/reset-card-lifecycle.ts", {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  })
}

test.beforeAll(resetLifecycles)
test.afterAll(resetLifecycles)

/** Page through the sorted table to the target card's row. */
async function findRow(page: Page): Promise<Locator> {
  await page.goto("/cards")
  await expect(page.getByRole("heading", { name: "Cards" })).toBeVisible()
  for (;;) {
    const row = page.getByTestId("card-row").filter({ hasText: CARD })
    if ((await row.count()) > 0) return row
    const next = page.getByRole("button", { name: "Next", exact: true })
    expect(await next.isEnabled(), `row "${CARD}" not found on any page`).toBe(true)
    await next.click()
  }
}

test("freeze shows the EDR-007 disclosure, flips the badge, and keeps the attention item", async ({
  page,
}) => {
  const row = await findRow(page)
  // High-utilization card starts un-frozen.
  await expect(row.getByText("High Utilization")).toBeVisible()

  await row.getByRole("button", { name: `Freeze ${CARD}`, exact: false }).click()

  // EDR-007: the confirm copy states this is in-app tracking only.
  await expect(
    page.getByText("It doesn't contact your issuer or stop charges — freeze with your bank for that.")
  ).toBeVisible()

  // Confirm (exact "Freeze" hits the popover button, not the aria-labelled trigger).
  await page.getByRole("button", { name: "Freeze", exact: true }).click()

  // Optimistic + reconciled: the status badge reads Frozen.
  await expect(row.getByText("Frozen")).toBeVisible()

  // Blueprint rule: FROZEN cards STILL surface attention items.
  await page.goto("/overview")
  await expect(
    page.getByTestId("attention-item").filter({ hasText: CARD })
  ).toBeVisible()
})

test("unfreeze reverts the badge to the underlying alert", async ({ page }) => {
  const row = await findRow(page)
  await expect(row.getByText("Frozen")).toBeVisible()

  await row.getByRole("button", { name: `Unfreeze ${CARD}`, exact: false }).click()
  await page.getByRole("button", { name: "Unfreeze", exact: true }).click()

  await expect(row.getByText("High Utilization")).toBeVisible()
})
