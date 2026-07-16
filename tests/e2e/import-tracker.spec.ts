/**
 * Tracker-import wizard (issue #28): upload → preview (every warning
 * surfaced, G14) → confirm → report, plus idempotent re-run.
 *
 * Runs in `authenticated-mutations` (after the read-only seed-fixture
 * specs). Hermeticity mirrors add-card.spec.ts: fixture cards carry the
 * "E2E " name prefix and scripts/delete-e2e-cards.ts runs before AND
 * after (the imported household lingers empty — it holds no cards after
 * cleanup, so seed-count specs are unaffected). Serial: the tests share
 * the fixture file and cleanup lifecycle.
 */
import { execSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"
import ExcelJS from "exceljs"

test.describe.configure({ mode: "serial" })

const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "tracker-e2e-"))
const fixturePath = path.join(fixtureDir, "e2e-tracker.xlsx")
const garbagePath = path.join(fixtureDir, "not-a-workbook.xlsx")

function deleteE2eCards() {
  execSync("pnpm exec tsx scripts/delete-e2e-cards.ts", {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  })
}

/** Two messy rows exercising the parser's warning surface end-to-end. */
async function writeFixture() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Card Tracker")
  // Row 6 — clean card with promo-free APR and a parseable payment.
  ws.getCell("B6").value = "E2E Import Quicksilver (Marti)"
  ws.getCell("C6").value = "4412"
  ws.getCell("D6").value = "Capital One"
  ws.getCell("F6").value = 1200.5
  ws.getCell("G6").value = 8799.5
  ws.getCell("I6").value = "No"
  ws.getCell("L6").value = 0.2274
  ws.getCell("N6").value = 19
  ws.getCell("O6").value = "$350/month"
  ws.getCell("R6").value = "e2e fixture"
  // Row 7 — xxxx last-four, no available credit (unknown limit), active
  // 0% promo, free-text payment: four distinct warnings/mappings.
  ws.getCell("B7").value = "E2E Import Freedom (Shared)"
  ws.getCell("C7").value = "xxxx"
  ws.getCell("D7").value = "Chase"
  ws.getCell("F7").value = 500
  ws.getCell("I7").value = "Yes"
  ws.getCell("J7").value = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 5, 15))
  ws.getCell("O7").value = "Statement Amt"
  writeFileSync(fixturePath, Buffer.from(await wb.xlsx.writeBuffer()))
  writeFileSync(garbagePath, "this is not an xlsx workbook")
}

test.beforeAll(async () => {
  deleteE2eCards()
  await writeFixture()
})
test.afterAll(() => {
  deleteE2eCards()
  rmSync(fixtureDir, { recursive: true, force: true })
})

async function uploadAndPreview(page: Page, file: string) {
  await page.goto("/cards/import")
  await expect(page.getByRole("heading", { name: "Import your tracker" })).toBeVisible()
  await page.getByLabel("Tracker workbook").setInputFiles(file)
  await page.getByRole("button", { name: "Preview import" }).click()
}

test("Settings links to the import screen", async ({ page }) => {
  await page.goto("/settings")
  await page.getByRole("link", { name: "Import Cards" }).click()
  await expect(page).toHaveURL(/\/cards\/import/)
  await expect(page.getByRole("heading", { name: "Import your tracker" })).toBeVisible()
})

test("preview surfaces every mapped field and warning before any write", async ({ page }) => {
  await uploadAndPreview(page, fixturePath)

  // Both cards mapped, owner split from the name parens.
  await expect(page.getByText("2 cards found")).toBeVisible()
  await expect(page.getByText("E2E Import Quicksilver")).toBeVisible()
  await expect(page.getByText("E2E Import Freedom")).toBeVisible()
  await expect(page.getByText("Marti", { exact: true })).toBeVisible()

  // Clean row: computed limit (balance + available) and parsed minimum.
  await expect(page.getByText("$10,000.00")).toBeVisible()
  await expect(page.getByText("$350.00")).toBeVisible()

  // Messy row: nothing guessed silently (G14) — the ambiguities are named.
  await expect(page.getByText(/fields need attention/)).toBeVisible()
  await expect(page.getByText(/last-four placeholder "xxxx"/)).toBeVisible()
  await expect(page.getByText(/credit limit unknown/)).toBeVisible()
  await expect(page.getByText(/kept as text/)).toBeVisible()
  await expect(page.getByText(/0% until/)).toBeVisible()

  // Preview is read-only: no card has been written yet.
  await page.goto("/cards")
  await expect(page.getByTestId("card-row").filter({ hasText: "E2E Import" })).toHaveCount(0)
})

test("confirm imports, reports per-row outcomes, and a re-run is a no-op", async ({ page }) => {
  await uploadAndPreview(page, fixturePath)
  await expect(page.getByText("2 cards found")).toBeVisible()

  // Server-confirmed import.
  await page.getByRole("button", { name: "Import 2 cards" }).click()
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  await expect(page.getByText(/2 created, 0 updated/)).toBeVisible()
  await expect(page.getByRole("cell", { name: "created" })).toHaveCount(2)

  // The imported card reaches the portfolio table.
  await page.goto("/cards")
  const row = page.getByTestId("card-row").filter({ hasText: "E2E Import Quicksilver" })
  for (;;) {
    if ((await row.count()) > 0) break
    const next = page.getByRole("button", { name: "Next", exact: true })
    expect(await next.isEnabled(), "imported row not found on any page").toBe(true)
    await next.click()
  }
  await expect(row).toBeVisible()

  // Idempotency: the same workbook again updates in place — no duplicates.
  await uploadAndPreview(page, fixturePath)
  await expect(page.getByText("2 cards found")).toBeVisible()
  await page.getByRole("button", { name: "Import 2 cards" }).click()
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  await expect(page.getByText(/0 created, 2 updated/)).toBeVisible()
  await expect(page.getByRole("cell", { name: "updated" })).toHaveCount(2)

  deleteE2eCards()
})

test("a non-workbook upload fails with a focused error and no write", async ({ page }) => {
  await uploadAndPreview(page, garbagePath)

  const banner = page.getByRole("alert")
  await expect(banner).toContainText("couldn't be read as an xlsx workbook")
  await expect(banner).toBeFocused()

  await page.goto("/cards")
  await expect(page.getByTestId("card-row").filter({ hasText: "E2E Import" })).toHaveCount(0)
})
