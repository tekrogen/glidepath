/**
 * Payment scheduling stepper (issue #45): happy path, draft resume, and
 * the two-tab idempotent confirm — the #28-style concurrency gap this
 * build closes with the `intentId @unique` DB backstop. All rows are
 * tagged (note "E2E-STEPPER") and swept before AND after the run so
 * seed-exact specs stay valid on a reused dev server. Date-independent:
 * dates are computed relative to the run date.
 */
import { execSync } from "node:child_process"

import { expect, test, type Page } from "@playwright/test"

test.describe.configure({ mode: "serial" })

const NOTE = "E2E-STEPPER"
const daysOut = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

const cleanup = () =>
  execSync("pnpm exec tsx scripts/e2e-stepper-cleanup.ts", { stdio: "inherit" })

test.beforeAll(cleanup)
test.afterAll(cleanup)

/** Drive the stepper to the review step. */
async function fillToReview(
  page: Page,
  card: string,
  amount: string,
  date: string
): Promise<void> {
  await page.goto("/payments/new")
  await page.getByTestId("stepper-card-option").filter({ hasText: card }).click()
  await page.getByTestId("payment-amount").fill(amount)
  await page.getByTestId("stepper-continue").click()
  await page.getByTestId("payment-date").fill(date)
  await page.getByTestId("payment-note").fill(NOTE)
  await page.getByTestId("stepper-continue").click()
  await expect(page.getByTestId("stepper-review")).toBeVisible()
}

test("happy path: runway CTA → stepper → record → chip on the runway", async ({ page }) => {
  await page.goto("/payments")
  await page.getByTestId("schedule-payment-cta").click()
  await expect(page).toHaveURL(/\/payments\/new$/)

  // Step 1 — card + amount (unique amount = unambiguous chip later).
  await page.getByTestId("stepper-card-option").filter({ hasText: "Meridian Blue" }).click()
  await page.getByTestId("payment-amount").fill("77.31")
  await page.getByTestId("stepper-continue").click()

  // Step 2 — date + funding + note.
  await page.getByTestId("payment-date").fill(daysOut(12))
  await page.getByTestId("funding-select").selectOption({ index: 1 })
  await page.getByTestId("payment-note").fill(NOTE)
  await page.getByTestId("stepper-continue").click()

  // Step 3 — review carries the entries + the record-only disclosure.
  await expect(page.getByTestId("review-card")).toHaveText("Meridian Blue")
  await expect(page.getByTestId("review-amount")).toHaveText("$77.31")
  await expect(page.getByText("Record-only:")).toBeVisible()

  await page.getByTestId("stepper-confirm").click()
  await expect(page.getByText("Payment recorded.")).toBeVisible()
  await expect(page).toHaveURL(/\/payments$/)
  await expect(
    page.locator('[data-kind="scheduled"]', { hasText: "$77.31" })
  ).toBeVisible()
})

test("a draft resumes after reload and can be discarded", async ({ page }) => {
  await page.goto("/payments/new")
  await page.getByTestId("stepper-card-option").filter({ hasText: "Fern Cash" }).click()
  await page.getByTestId("payment-amount").fill("12.34")
  await page.getByTestId("stepper-continue").click()
  await expect(page.getByTestId("payment-date")).toBeVisible()

  // Reload → the DB-backed draft resumes at step 2 with state intact.
  await page.reload()
  await expect(page.getByTestId("stepper-step-2")).toHaveAttribute("aria-current", "step")
  await page.getByTestId("stepper-back").click()
  await expect(page.getByTestId("payment-amount")).toHaveValue("12.34")

  await page.getByTestId("stepper-discard").click()
  await expect(page.getByText("Draft discarded.")).toBeVisible()
  await expect(page.getByTestId("payment-amount")).toHaveValue("")
})

test("two-tab confirm converges on ONE payment (intentId unique backstop)", async ({
  context,
  page,
}) => {
  const amount = "55.66"
  await fillToReview(page, "Fern Cash", amount, daysOut(9))

  // Tab B resumes the same complete draft straight at review.
  const pageB = await context.newPage()
  await pageB.goto("/payments/new")
  await expect(pageB.getByTestId("stepper-review")).toBeVisible()

  // A confirms first; B's confirm must be an idempotent no-op.
  await page.getByTestId("stepper-confirm").click()
  await expect(page.getByText("Payment recorded.")).toBeVisible()
  await pageB.getByTestId("stepper-confirm").click()
  await expect(pageB.getByText("This payment was already recorded.")).toBeVisible()
  await expect(pageB).toHaveURL(/\/payments$/)

  // Exactly one chip exists for the amount — the DB backstop held.
  await page.goto("/payments")
  await expect(page.locator('[data-kind="scheduled"]', { hasText: `$${amount}` })).toHaveCount(1)
  await pageB.close()
})
