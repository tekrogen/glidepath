/**
 * Card edit + delete e2e (issue #47, #57's delete half, #78 owner). Runs in
 * authenticated-mutations. Hermetic with a spec-OWN prefix (`E2EEDIT `,
 * review finding): add-card.spec runs in a parallel worker sweeping the
 * bare `E2E ` prefix — a shared prefix would let either spec delete the
 * other's live fixtures. Cleanup order matters (review finding): the
 * payment tag is swept BEFORE the card sweep, so a failure that strands
 * the dependents fixture can never make the raw card sweep hit the
 * Restrict FK (P2003) and poison every later run. Date-independent.
 */
import { execSync } from "node:child_process"

import { expect, test, type Page } from "@playwright/test"

const PREFIX = "E2EEDIT "
const DEP_TAG = "E2E-DEL-DEP"

const cleanup = () => {
  // Payments first (Restrict FK), then the cards themselves.
  execSync(`pnpm exec tsx scripts/e2e-scheduled-payment.ts delete ${DEP_TAG}`, {
    stdio: "inherit",
  })
  execSync(`pnpm exec tsx scripts/delete-e2e-cards.ts "${PREFIX}"`, { stdio: "inherit" })
}

test.describe.configure({ mode: "serial" })

test.beforeAll(cleanup)
test.afterAll(cleanup)

/** Create a minimal E2E card through the real add flow; returns its name. */
async function createCard(page: Page, suffix: string, fields: Record<string, string> = {}) {
  const name = `${PREFIX}${suffix} ${Date.now()}`
  await page.goto("/cards")
  await page.getByRole("button", { name: "+ Add Card" }).click()
  await page.getByLabel("Card name *").fill(name)
  await page.getByLabel("Issuer *").fill("E2E Bank")
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label).fill(value)
  }
  await page.getByRole("button", { name: "Add card", exact: true }).click()
  await expect(page.getByText(`${name} added.`)).toBeVisible()
  return name
}

/** Page through the table until the named row is visible, then return it. */
async function findRow(page: Page, name: string) {
  await page.goto("/cards")
  const row = page.getByTestId("card-row").filter({ hasText: name })
  for (let i = 0; i < 3; i++) {
    if ((await row.count()) > 0) break
    // exact — "Open Next.js Dev Tools" also matches a bare "Next" name filter.
    await page.getByRole("button", { name: "Next", exact: true }).click()
  }
  await expect(row).toHaveCount(1)
  return row
}

test("edit round-trip: values change, provenance-backed cells update", async ({ page }) => {
  const name = await createCard(page, "RT", { "Credit limit ($)": "1000.00" })
  const row = await findRow(page, name)

  await row.getByRole("button", { name: `Edit ${name}` }).click()
  // The sheet seeds from the stored card — the limit typed at create is here.
  await expect(page.getByLabel("Credit limit ($)")).toHaveValue("1000.00")

  await page.getByLabel("Credit limit ($)").fill("2500.00")
  await page.getByLabel("Current balance ($)").fill("500.00")
  await page.getByLabel("Payment due day (1–31)").fill("15")
  await page.getByLabel("Regular APR (%)").fill("21.99")
  await page.getByTestId("save-card").click()
  await expect(page.getByText(`${name} saved.`)).toBeVisible()

  const after = await findRow(page, name)
  await expect(after).toContainText("$2,500.00") // limit
  await expect(after).toContainText("$500.00") // balance
  await expect(after).toContainText("21.99%")
  await expect(after).toContainText("15") // due day

  // Reload — server truth, not optimism.
  const reloaded = await findRow(page, name)
  await expect(reloaded).toContainText("$2,500.00")
})

test("validation: a bad amount is rejected in place, entries preserved", async ({ page }) => {
  const name = await createCard(page, "VAL")
  const row = await findRow(page, name)
  await row.getByRole("button", { name: `Edit ${name}` }).click()

  await page.getByLabel("Credit limit ($)").fill("abc")
  await page.getByTestId("save-card").click()
  await expect(page.getByText("Check the highlighted fields.")).toBeVisible()
  // The typed string survives the failed submit (React 19 re-seed idiom).
  await expect(page.getByLabel("Credit limit ($)")).toHaveValue("abc")
})

test("owner designation (issue #78): assign a member, then back to shared", async ({ page }) => {
  const name = await createCard(page, "OWN")
  let row = await findRow(page, name)
  await expect(row).not.toContainText("Marti") // created shared

  await row.getByRole("button", { name: `Edit ${name}` }).click()
  await page.getByTestId("owner-select").selectOption({ label: "Marti" })
  await page.getByTestId("save-card").click()
  await expect(page.getByText(`${name} saved.`)).toBeVisible()

  row = await findRow(page, name)
  await expect(row).toContainText("Marti") // owner chip renders

  await row.getByRole("button", { name: `Edit ${name}` }).click()
  await page.getByTestId("owner-select").selectOption({ label: "Shared — whole household" })
  await page.getByTestId("save-card").click()
  await expect(page.getByText(`${name} saved.`)).toBeVisible()
  row = await findRow(page, name)
  await expect(row).not.toContainText("Marti")
})

test("delete without dependents: confirm-gated, row disappears", async ({ page }) => {
  const name = await createCard(page, "DEL")
  const row = await findRow(page, name)
  await row.getByRole("button", { name: `Edit ${name}` }).click()

  await page.getByTestId("delete-card").click()
  await expect(page.getByText(`Delete ${name}?`)).toBeVisible()
  // No dependents ⇒ the plain copy, no counts.
  await expect(page.getByText("This permanently removes the card.", { exact: false })).toBeVisible()

  // Cancel first — nothing happens.
  await page.getByRole("button", { name: "Keep card" }).click()
  await page.getByTestId("save-card").waitFor()

  await page.getByTestId("delete-card").click()
  await page.getByTestId("delete-card-confirm").click()
  await expect(page.getByText(`${name} deleted.`)).toBeVisible()

  await page.goto("/cards")
  await expect(page.getByTestId("card-row").filter({ hasText: name })).toHaveCount(0)
})

test("delete WITH dependents (issue #57): dialog lists them, removal is transactional", async ({
  page,
}) => {
  const name = await createCard(page, "DEP")
  // Restrict-FK row on the new card: a $77.00 scheduled payment, distinct
  // amount + tag per the parallel-spec rule.
  execSync(`pnpm exec tsx scripts/e2e-scheduled-payment.ts create 5 7700 ${DEP_TAG} "${name}"`, {
    stdio: "inherit",
  })

  const row = await findRow(page, name)
  await row.getByRole("button", { name: `Edit ${name}` }).click()
  await page.getByTestId("delete-card").click()
  // The confirm names exactly what rides along — the informed consent #57 requires.
  await expect(page.getByText("1 scheduled payment", { exact: false })).toBeVisible()

  await page.getByTestId("delete-card-confirm").click()
  await expect(page.getByText(`${name} deleted.`)).toBeVisible()

  // Card gone from the table AND its payment gone from the runway.
  await page.goto("/cards")
  await expect(page.getByTestId("card-row").filter({ hasText: name })).toHaveCount(0)
  await page.goto("/payments")
  await expect(page.locator('[data-kind="scheduled"]', { hasText: "$77.00" })).toHaveCount(0)
})
