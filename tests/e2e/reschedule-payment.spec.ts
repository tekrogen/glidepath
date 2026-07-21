/**
 * Runway reschedule (issue #44) — the mutation path. The fixture's own
 * SCHEDULED rows age out of the 45-day window (they are pinned to the
 * dataset's 2026-07-11 anchor), so the spec inserts its own $42.00 row
 * at today+10 via scripts/e2e-scheduled-payment.ts and removes it after
 * — the seeded payment fixture is never touched, so seed-exact specs
 * stay valid even on a reused dev server.
 */
import { execSync } from "node:child_process"

import { expect, test } from "@playwright/test"

test.describe.configure({ mode: "serial" })

const CHIP = '[data-testid="runway-event"][data-kind="scheduled"]'

test.beforeAll(() => {
  execSync("pnpm exec tsx scripts/e2e-scheduled-payment.ts create", { stdio: "inherit" })
})

test.afterAll(() => {
  execSync("pnpm exec tsx scripts/e2e-scheduled-payment.ts delete", { stdio: "inherit" })
})

test("keyboard reschedule previews ~interest, commits, and persists", async ({ page }) => {
  await page.goto("/payments")
  const chip = page.locator(CHIP, { hasText: "$42.00" })
  await expect(chip).toBeVisible()
  const before = await chip.textContent()

  await chip.focus()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowRight")

  // Live preview: card, move, and the ~interest estimate (EDR-020 "~").
  const preview = page.getByTestId("reschedule-preview")
  await expect(preview).toContainText("Meridian Blue")
  await expect(preview).toContainText("+2 days")
  await expect(preview).toContainText("~")
  await expect(preview).toContainText("more interest")

  await page.keyboard.press("Enter")
  await expect(page.getByText(/payment moved/i)).toBeVisible()
  await expect(page.getByTestId("reschedule-panel")).toContainText("Drag a payment chip")

  // Persisted, not just optimistic: a fresh load renders the moved date.
  await page.reload()
  const after = page.locator(CHIP, { hasText: "$42.00" })
  await expect(after).toBeVisible()
  expect(await after.textContent()).not.toBe(before)
})

test("tap-select exposes the button reschedule path (SC 2.5.7)", async ({ page }) => {
  await page.goto("/payments")
  const chip = page.locator(CHIP, { hasText: "$42.00" })
  await expect(chip).toBeVisible()
  const before = await chip.textContent()

  // A plain click selects — never moves — the payment.
  await chip.click()
  const preview = page.getByTestId("reschedule-preview")
  await expect(preview).toContainText("Meridian Blue")
  await expect(preview).toContainText("No change.")

  await page.getByRole("button", { name: "A day later" }).click()
  await expect(preview).toContainText("+1 day")
  await page.getByTestId("reschedule-confirm").click()
  await expect(page.getByText(/payment moved/i)).toBeVisible()

  await page.reload()
  const after = page.locator(CHIP, { hasText: "$42.00" })
  await expect(after).toBeVisible()
  expect(await after.textContent()).not.toBe(before)
})

test("Escape cancels a pending move without persisting", async ({ page }) => {
  await page.goto("/payments")
  const chip = page.locator(CHIP, { hasText: "$42.00" })
  await expect(chip).toBeVisible()
  const before = await chip.textContent()

  await chip.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(page.getByTestId("reschedule-preview")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("reschedule-panel")).toContainText("Drag a payment chip")
  expect(await chip.textContent()).toBe(before)

  await page.reload()
  expect(await page.locator(CHIP, { hasText: "$42.00" }).textContent()).toBe(before)
})
