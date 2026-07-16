/**
 * Tracker-import wizard (issue #28): upload → preview (every warning
 * surfaced, G14) → confirm → report, plus idempotent re-run.
 *
 * Runs in `authenticated-mutations` (after the read-only seed-fixture
 * specs). Hermeticity: fixture cards carry the "E2EIMP " name prefix —
 * deliberately DISJOINT from add-card.spec's "E2E " prefix, because the
 * two files run in parallel workers locally and a shared-prefix cleanup
 * would delete the other spec's in-flight fixtures. Cleanup runs before
 * AND after via scripts/delete-e2e-cards.ts "E2EIMP ". The import targets
 * the demo user's existing (seeded) household, so no stray household or
 * membership survives the run. Serial: the tests share the fixture files
 * and cleanup lifecycle.
 *
 * The fixture puts TWO cards on the same issuer + last four (4412): if the
 * write path ever regresses to matching on last-four (forbidden — real
 * portfolios contain duplicates), the created/updated counts asserted
 * below change and this spec fails.
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
const emptyPath = path.join(fixtureDir, "e2e-tracker-empty.xlsx")
const garbagePath = path.join(fixtureDir, "not-a-workbook.xlsx")
const oversizedPath = path.join(fixtureDir, "oversized.xlsx")

function deleteE2eCards() {
  execSync('pnpm exec tsx scripts/delete-e2e-cards.ts "E2EIMP "', {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  })
}

/** Three messy rows exercising the parser's warning surface end-to-end. */
async function writeFixtures() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Card Tracker")
  // Row 6 — clean card with promo-free APR and a parseable payment.
  ws.getCell("B6").value = "E2EIMP Quicksilver (Marti)"
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
  ws.getCell("B7").value = "E2EIMP Freedom (Shared)"
  ws.getCell("C7").value = "xxxx"
  ws.getCell("D7").value = "Chase"
  ws.getCell("F7").value = 500
  ws.getCell("I7").value = "Yes"
  ws.getCell("J7").value = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 5, 15))
  ws.getCell("O7").value = "Statement Amt"
  // Row 8 — SAME issuer + last four as row 6, different name: the match
  // key must treat these as two distinct cards (never last-four alone).
  ws.getCell("B8").value = "E2EIMP Venture (Marti)"
  ws.getCell("C8").value = "4412"
  ws.getCell("D8").value = "Capital One"
  ws.getCell("F8").value = 300
  ws.getCell("G8").value = 700
  writeFileSync(fixturePath, Buffer.from(await wb.xlsx.writeBuffer()))

  const emptyWb = new ExcelJS.Workbook()
  emptyWb.addWorksheet("Card Tracker")
  writeFileSync(emptyPath, Buffer.from(await emptyWb.xlsx.writeBuffer()))

  writeFileSync(garbagePath, "this is not an xlsx workbook")
  writeFileSync(oversizedPath, Buffer.alloc(1_500_000, 1))
}

test.beforeAll(async () => {
  deleteE2eCards()
  await writeFixtures()
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

  // All three cards mapped, owner split from the name parens.
  // Scoped to the visible header (the sr-only live region also announces
  // the count).
  await expect(page.getByText("e2e-tracker.xlsx — 3 cards found")).toBeVisible()
  await expect(page.getByText("E2EIMP Quicksilver")).toBeVisible()
  await expect(page.getByText("E2EIMP Freedom")).toBeVisible()
  await expect(page.getByText("E2EIMP Venture")).toBeVisible()
  await expect(page.getByText("Marti", { exact: true })).toHaveCount(2)

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
  await expect(page.getByTestId("card-row").filter({ hasText: "E2EIMP" })).toHaveCount(0)
})

test("confirm imports, reports per-row outcomes, and a re-run is a no-op", async ({ page }) => {
  await uploadAndPreview(page, fixturePath)
  // Scoped to the visible header (the sr-only live region also announces
  // the count).
  await expect(page.getByText("e2e-tracker.xlsx — 3 cards found")).toBeVisible()

  // Server-confirmed import.
  await page.getByRole("button", { name: "Import 3 cards" }).click()
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  await expect(page.getByText(/3 created, 0 updated/)).toBeVisible()
  await expect(page.getByRole("cell", { name: "Created" })).toHaveCount(3)

  // The imported card reaches the portfolio table.
  await page.goto("/cards")
  const row = page.getByTestId("card-row").filter({ hasText: "E2EIMP Quicksilver" })
  for (;;) {
    if ((await row.count()) > 0) break
    const next = page.getByRole("button", { name: "Next", exact: true })
    expect(await next.isEnabled(), "imported row not found on any page").toBe(true)
    await next.click()
  }
  await expect(row).toBeVisible()
  await expect(row).toContainText("$1,200.50")

  // Idempotency: the same workbook again updates in place — no duplicates,
  // and the card DATA is unchanged, not just the counts.
  await uploadAndPreview(page, fixturePath)
  // Scoped to the visible header (the sr-only live region also announces
  // the count).
  await expect(page.getByText("e2e-tracker.xlsx — 3 cards found")).toBeVisible()
  await page.getByRole("button", { name: "Import 3 cards" }).click()
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  await expect(page.getByText(/0 created, 3 updated/)).toBeVisible()
  await expect(page.getByRole("cell", { name: "Updated" })).toHaveCount(3)

  await page.goto("/cards")
  const rowAfter = page.getByTestId("card-row").filter({ hasText: "E2EIMP Quicksilver" })
  for (;;) {
    if ((await rowAfter.count()) > 0) break
    const next = page.getByRole("button", { name: "Next", exact: true })
    expect(await next.isEnabled(), "row lost after re-import").toBe(true)
    await next.click()
  }
  await expect(rowAfter).toHaveCount(1)
  await expect(rowAfter).toContainText("$1,200.50")

  deleteE2eCards()
})

test("a non-workbook upload fails with a focused error, no write, and retry works", async ({
  page,
}) => {
  await uploadAndPreview(page, garbagePath)

  const banner = page.getByTestId("import-error")
  await expect(banner).toContainText("couldn't be read as an xlsx workbook")
  await expect(banner).toBeFocused()

  await page.goto("/cards")
  await expect(page.getByTestId("card-row").filter({ hasText: "E2EIMP" })).toHaveCount(0)

  // Error → retry: choosing the real workbook recovers in place.
  await uploadAndPreview(page, fixturePath)
  // Scoped to the visible header (the sr-only live region also announces
  // the count).
  await expect(page.getByText("e2e-tracker.xlsx — 3 cards found")).toBeVisible()
  await expect(page.getByTestId("import-error")).toHaveCount(0)
})

test("an empty tracker and an oversized file both fail with named errors", async ({ page }) => {
  await uploadAndPreview(page, emptyPath)
  await expect(page.getByTestId("import-error")).toContainText("No cards found in rows 6–25")

  // Oversized is rejected client-side before any upload.
  await page.getByLabel("Tracker workbook").setInputFiles(oversizedPath)
  await page.getByRole("button", { name: "Preview import" }).click()
  await expect(page.getByTestId("import-error")).toContainText("too large to be a card tracker")
})
