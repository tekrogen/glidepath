/**
 * Monarch balances import e2e (issue #48). Hermetic: fixture cards carry
 * the spec-own "E2EMON " prefix (disjoint from add-card's "E2E " and the
 * tracker spec's "E2EIMP ") and are created through the PROVEN tracker
 * import flow — no new prisma script. CSVs are generated at runtime in a
 * tmpdir; the real export stays local-only/gitignored. Cleanup before AND
 * after via delete-e2e-cards "E2EMON " (balance updates leave no Restrict
 * rows, so the raw sweep is safe). Date-independent: no assertions depend
 * on the run date. The duplicate-lastFour pair (Beta/Gamma ····7727) is
 * the REGRESSION TRIPWIRE: any future change that auto-matches on
 * last-four alone flips their preview statuses and fails this spec.
 */
import { execSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"
import ExcelJS from "exceljs"

const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "monarch-e2e-"))
const trackerPath = path.join(fixtureDir, "e2emon-cards.xlsx")
const csvPath = path.join(fixtureDir, "e2emon-balances.csv")
const wrongHeaderPath = path.join(fixtureDir, "wrong-header.csv")
const garbagePath = path.join(fixtureDir, "garbage.csv")
const oversizedPath = path.join(fixtureDir, "oversized.csv")

function deleteE2eCards() {
  execSync('pnpm exec tsx scripts/delete-e2e-cards.ts "E2EMON "', {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", ".."),
  })
}

/** Four cards via the tracker-xlsx path: Alpha 1111 (unique suffix →
 *  Suggested), Beta+Gamma sharing 7727 (the tripwire pair → ambiguous),
 *  Delta 9931 (gets a credit-balance CSV row → clamp warning). */
async function writeFixtures() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Card Tracker")
  const rows: Array<[string, string, string, number]> = [
    ["E2EMON Alpha", "1111", "E2E Bank", 100.0],
    ["E2EMON Beta", "7727", "E2E Bank", 200.0],
    ["E2EMON Gamma", "7727", "E2E Bank", 300.0],
    ["E2EMON Delta", "9931", "E2E Bank", 400.0],
  ]
  rows.forEach(([name, lastFour, issuer, balance], i) => {
    const r = 6 + i
    ws.getCell(`B${r}`).value = name
    ws.getCell(`C${r}`).value = lastFour
    ws.getCell(`D${r}`).value = issuer
    ws.getCell(`F${r}`).value = balance
    ws.getCell(`G${r}`).value = 5000 - balance
  })
  writeFileSync(trackerPath, Buffer.from(await wb.xlsx.writeBuffer()))

  // CRLF + a quoted comma + ® in an account name; two dates so latest wins;
  // a positive (credit) latest for Delta; a bank row; an orphan card row.
  writeFileSync(
    csvPath,
    [
      "Date,Balance,Account",
      '2026-07-16,-150.00,"Alpha, Card® (...1111)"',
      '2026-07-17,-176.82,"Alpha, Card® (...1111)"',
      "2026-07-17,-55.00,Store Card (...7727)",
      "2026-07-17,25.00,E2EMON Delta Card (...9931)",
      "2026-07-17,900.00,E2EMON Checking (...9001)",
      // 8888 is absent from BOTH the seed's last-fours and this spec's cards
      // — a suffix collision with a seed card would silently auto-bind it.
      "2026-07-17,-10.00,Orphan (...8888)",
      "",
    ].join("\r\n")
  )
  writeFileSync(wrongHeaderPath, "Name,Amount,Foo\r\nx,1,2\r\n")
  writeFileSync(garbagePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01]))
  writeFileSync(oversizedPath, Buffer.alloc(1_500_000, 0x41))
}

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  deleteE2eCards()
  await writeFixtures()
})
test.afterAll(() => {
  deleteE2eCards()
  rmSync(fixtureDir, { recursive: true, force: true })
})

async function openMonarchTab(page: Page) {
  await page.goto("/cards/import?source=monarch")
  await expect(page.getByRole("tab", { name: "Monarch balances" })).toHaveAttribute(
    "data-state",
    "active"
  )
}

async function uploadAndPreview(page: Page, file: string) {
  await openMonarchTab(page)
  await page.getByLabel("Balances CSV").setInputFiles(file)
  await page.getByTestId("monarch-preview").click()
}

/** The cards table pages at 10 — page through until the named row shows. */
async function findCardRow(page: Page, name: string) {
  await page.goto("/cards")
  const row = page.getByTestId("card-row").filter({ hasText: name })
  for (let i = 0; i < 4; i++) {
    if ((await row.count()) > 0) break
    await page.getByRole("button", { name: "Next", exact: true }).click()
  }
  await expect(row).toHaveCount(1)
  return row
}

test("setup: create the four E2EMON cards through the tracker flow", async ({ page }) => {
  await page.goto("/cards/import")
  await page.getByRole("tabpanel").getByLabel("Tracker workbook").setInputFiles(trackerPath)
  await page.getByRole("button", { name: "Preview import" }).click()
  await page.getByRole("button", { name: /Import 4 card/ }).click()
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
})

test("Settings deep-links to the Monarch tab", async ({ page }) => {
  await page.goto("/settings")
  await page.getByRole("link", { name: "Import Balances" }).click()
  await expect(page).toHaveURL(/source=monarch/)
  await expect(page.getByLabel("Balances CSV")).toBeVisible()
})

test("preview: statuses, tripwire ambiguity with NO preselection, deltas, buckets", async ({
  page,
}) => {
  await uploadAndPreview(page, csvPath)

  // Suggested: unique suffix 1111 → Alpha, pre-linked, delta shown.
  const alphaRow = page.getByTestId("monarch-row").filter({ hasText: "Alpha, Card®" })
  await expect(alphaRow).toHaveAttribute("data-status", "suggested")
  await expect(alphaRow.getByTestId("monarch-delta")).toContainText("$100.00 → $176.82")

  // TRIPWIRE: 7727 maps to TWO cards (Beta, Gamma) → ambiguous, no
  // preselection, confirm disabled. Any last-four-alone auto-match
  // regression changes these assertions.
  const storeRow = page.getByTestId("monarch-row").filter({ hasText: "Store Card" })
  await expect(storeRow).toHaveAttribute("data-status", "ambiguous")
  await expect(storeRow.getByTestId("monarch-picker")).toHaveValue("")
  await expect(page.getByTestId("monarch-confirm")).toBeDisabled()
  await expect(page.getByText("1 account needs a choice")).toBeVisible()

  // Credit-balance clamp warning on Delta (+25.00 → $0 owed).
  const deltaRow = page.getByTestId("monarch-row").filter({ hasText: "Delta Card" })
  await expect(deltaRow).toContainText("credit balance")

  // Bank row in the skipped bucket; orphan card unmatched (skipped label).
  await expect(page.getByText(/Other accounts skipped \(1\)/)).toBeVisible()
  const orphanRow = page.getByTestId("monarch-row").filter({ hasText: "Orphan" })
  await expect(orphanRow).toHaveAttribute("data-status", "unmatched")

  // EXPLICIT SKIP is reachable in one action (DS-48-001: the placeholder
  // and the skip are distinct options — selecting skip must fire and
  // unblock confirm without ever picking a card).
  await storeRow.getByTestId("monarch-picker").selectOption("__skip")
  await expect(storeRow.getByText("Skipped")).toBeVisible()
  await expect(page.getByTestId("monarch-confirm")).toBeEnabled()
})

test("resolve, confirm, verify to the cent; then re-run is a remembered no-op", async ({
  page,
}) => {
  await uploadAndPreview(page, csvPath)

  // Resolve the tripwire to Beta; the picker disables Beta elsewhere.
  const storeRow = page.getByTestId("monarch-row").filter({ hasText: "Store Card" })
  const picker = storeRow.getByTestId("monarch-picker")
  const betaValue = await picker
    .locator("option", { hasText: "E2EMON Beta" })
    .getAttribute("value")
  await picker.selectOption(betaValue!)
  await expect(page.getByTestId("monarch-confirm")).toBeEnabled()
  await page.getByTestId("monarch-confirm").click()

  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  const report = page.getByTestId("monarch-report")
  await expect(report).toContainText("E2EMON Alpha")
  await expect(report).toContainText("$100.00 → $176.82")
  await expect(report).toContainText("E2EMON Beta")
  await expect(report).toContainText("$200.00 → $55.00")
  await expect(report).toContainText("E2EMON Delta")
  await expect(report).toContainText("$400.00 → $0.00")

  // Table shows the new balances to the cent; card count unchanged.
  const alpha = await findCardRow(page, "E2EMON Alpha")
  await expect(alpha).toContainText("$176.82")
  const beta = await findCardRow(page, "E2EMON Beta")
  await expect(beta).toContainText("$55.00")
  const gamma = await findCardRow(page, "E2EMON Gamma")
  await expect(gamma).toContainText("$300.00") // untouched

  // Re-run the SAME bytes: everything Remembered, zero pickers required,
  // confirm enabled immediately, report says 0 balance changes.
  await uploadAndPreview(page, csvPath)
  const rememberedStore = page.getByTestId("monarch-row").filter({ hasText: "Store Card" })
  await expect(rememberedStore).toHaveAttribute("data-status", "remembered")
  await expect(page.getByTestId("monarch-confirm")).toBeEnabled()
  await page.getByTestId("monarch-confirm").click()
  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  await expect(page.getByText(/0 balance changes/)).toBeVisible()
})

test("re-linking a remembered account to a different card succeeds (stale-key clearing)", async ({
  page,
}) => {
  // Store Card is remembered on Beta from the previous test. Re-link it to
  // Gamma — pre-fix, the unique-constraint clearing excluded update-set
  // cards and this aborted the whole import (review finding, high).
  await uploadAndPreview(page, csvPath)
  const storeRow = page.getByTestId("monarch-row").filter({ hasText: "Store Card" })
  await expect(storeRow).toHaveAttribute("data-status", "remembered")
  const picker = storeRow.getByTestId("monarch-picker")
  const gammaValue = await picker
    .locator("option", { hasText: "E2EMON Gamma" })
    .getAttribute("value")
  await picker.selectOption(gammaValue!)
  await page.getByTestId("monarch-confirm").click()

  await expect(page.getByRole("heading", { name: "Import complete" })).toBeVisible()
  const report = page.getByTestId("monarch-report")
  await expect(report).toContainText("E2EMON Gamma")
  await expect(report).toContainText("$300.00 → $55.00")

  // Gamma took the balance + key; Beta keeps its last value, now unlinked.
  const gamma = await findCardRow(page, "E2EMON Gamma")
  await expect(gamma).toContainText("$55.00")
  const beta = await findCardRow(page, "E2EMON Beta")
  await expect(beta).toContainText("$55.00")
})

test("error paths: wrong header, garbage bytes, oversize", async ({ page }) => {
  await uploadAndPreview(page, wrongHeaderPath)
  await expect(page.getByTestId("import-error")).toContainText("Monarch balances export")

  await uploadAndPreview(page, garbagePath)
  await expect(page.getByTestId("import-error")).toBeVisible()

  await openMonarchTab(page)
  await page.getByLabel("Balances CSV").setInputFiles(oversizedPath)
  await page.getByTestId("monarch-preview").click()
  await expect(page.getByTestId("import-error")).toContainText("shorter date range")
})
