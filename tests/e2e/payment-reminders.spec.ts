/**
 * Payment reminders + autopay affordances + intent-expiry cron (issue
 * #46). Date-independent by construction: the seed's due days leave no
 * gap over 7 days and its no-coverage cards (no autopay, no payments)
 * guarantee at least one uncovered in-window due at ANY run date; the
 * PAYMENT_REMINDER case inserts its own row at today+2; the cron case
 * inserts its own stale draft.
 */
import { execSync } from "node:child_process"

import { expect, test } from "@playwright/test"

import { SEED_CARDS } from "../../prisma/seed-data/glidepath-cards"

/**
 * The overview widget shows the SIX soonest dues, which rotate with the
 * calendar — whether a specific card's row is visible is date-dependent.
 * Recompute the visible set from the seed (same next-due rule as the app)
 * so chip assertions only run when their row is actually rendered; the
 * runway cue below covers the autopay data path on every run.
 */
function visibleUpcomingNames(today: Date): Set<string> {
  const upcoming = SEED_CARDS.filter((c) => c.paymentDueDay != null).map((c) => {
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth()
    const thisMonth = new Date(Date.UTC(y, m, Math.min(c.paymentDueDay!, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())))
    const due = thisMonth >= new Date(Date.UTC(y, m, today.getUTCDate()))
      ? thisMonth
      : new Date(Date.UTC(y, m + 1, Math.min(c.paymentDueDay!, new Date(Date.UTC(y, m + 2, 0)).getUTCDate())))
    return { name: c.cardName, due }
  })
  upcoming.sort((a, b) => a.due.getTime() - b.due.getTime() || a.name.localeCompare(b.name))
  return new Set(upcoming.slice(0, 6).map((u) => u.name))
}

// Must match playwright.config.ts webServer.env.CRON_SECRET.
const CRON_SECRET = "e2e-cron-secret"

test.describe.configure({ mode: "serial" })

test.beforeAll(() => {
  execSync("pnpm exec tsx scripts/e2e-scheduled-payment.ts create 2 4300 E2E-REMINDER", { stdio: "inherit" })
  execSync("pnpm exec tsx scripts/e2e-intent-fixture.ts create-stale", { stdio: "inherit" })
  execSync("pnpm exec tsx scripts/reset-demo-notifications.ts", { stdio: "inherit" })
})

test.afterAll(() => {
  execSync("pnpm exec tsx scripts/e2e-scheduled-payment.ts delete E2E-REMINDER", { stdio: "inherit" })
  execSync("pnpm exec tsx scripts/e2e-intent-fixture.ts delete", { stdio: "inherit" })
  execSync("pnpm exec tsx scripts/reset-demo-notifications.ts", { stdio: "inherit" })
})

test("due-date and planned-payment reminders land in the notification panel", async ({ page }) => {
  // The panel read syncs the occurrence set (write-on-read, #25 design).
  await page.goto("/overview")
  await page.getByRole("button", { name: /Notifications \(/ }).click()

  // Exit criterion: a due-date occurrence from the seeded fixture…
  await expect(
    page.getByTestId("notification-row").filter({ hasText: "Payment due soon" }).first()
  ).toBeVisible()
  // …and the $42.00 payment inserted at today+2 reminds as planned.
  await expect(
    page.getByTestId("notification-row").filter({ hasText: "Planned payment in 2 days" })
  ).toBeVisible()
  await expect(
    page.getByTestId("notification-row").filter({ hasText: "$43.00" })
  ).toBeVisible()
})

test("autopay affordances: Auto chip, Pay link-out, runway auto cue", async ({ page }) => {
  const visible = visibleUpcomingNames(new Date())
  await page.goto("/overview")

  // Beacon Everyday: autopayActive → muted Auto chip, no link (when its row
  // is inside the six-row cap this run).
  if (visible.has("Beacon Everyday")) {
    const beaconRow = page.getByTestId("upcoming-payment").filter({ hasText: "Beacon Everyday" })
    await expect(beaconRow.getByTestId("autopay-chip")).toBeVisible()
    await expect(beaconRow.getByTestId("pay-link")).toHaveCount(0)
  }
  // Summit Travel: recorded provider URL, autopay NOT confirmed → Pay link-out.
  if (visible.has("Summit Travel")) {
    const summitRow = page.getByTestId("upcoming-payment").filter({ hasText: "Summit Travel" })
    const payLink = summitRow.getByTestId("pay-link")
    await expect(payLink).toHaveAttribute("href", "https://www.chase.com/pay")
    await expect(payLink).toHaveAttribute("target", "_blank")
    await expect(payLink).toHaveAttribute("rel", /noopener/)
  }

  // ALWAYS asserted: Beacon has a due occurrence in every 45-day window, so
  // the runway carries the Hi-Fi "auto ✓" cue on every run date.
  await page.goto("/payments")
  await expect(
    page
      .locator('[data-testid="runway-event"][data-kind="due"]', { hasText: "auto ✓" })
      .first()
  ).toBeVisible()
})

test("intent-expiry cron: 401 without the secret, expires exactly the stale draft", async ({
  request,
}) => {
  const unauthorized = await request.post("/api/cron/intent-expiry")
  expect(unauthorized.status()).toBe(401)

  const run = await request.post("/api/cron/intent-expiry", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
  expect(run.status()).toBe(200)
  const body = await run.json()
  expect(body.success).toBe(true)
  expect(body.expired).toBeGreaterThanOrEqual(1)

  // Idempotent: the flip happened; a second run finds nothing stale.
  const again = await request.post("/api/cron/intent-expiry", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
  expect((await again.json()).expired).toBe(0)
})
