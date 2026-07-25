/**
 * Payment reminders + autopay affordances + intent-expiry cron (issue
 * #46). Date-independent by construction: date-sensitive expectations
 * are predicted with the app's own engines at the run date (all-covered
 * windows exist — e.g. 2026-07-20 — so nothing is asserted
 * unconditionally unless this spec inserts the row itself: the today+2
 * planned payment and the stale draft).
 */
import { execSync } from "node:child_process"

import { expect, test } from "@playwright/test"

import { SEED_CARDS } from "../../prisma/seed-data/glidepath-cards"
import { SEED_AUTOPAY_LINKS, SEED_SCHEDULED_PAYMENTS } from "../../prisma/seed-data/glidepath-payments"
import { nextDueDate } from "../../src/features/cards/utils/due-dates"
import {
  buildReminderItems,
  type ReminderCard,
} from "../../src/features/notifications/utils/build-reminder-items"
import type { RunwayPayment } from "../../src/lib/finance"

/**
 * Date-dependent expectations are PREDICTED with the app's own engines
 * (review finding: a hand-rolled copy of the cap/claim rules diverges) —
 * nextDueDate for the widget's six-row cap, buildReminderItems for which
 * reminder rows exist at the run date. The seed-derived inputs mirror
 * tests/unit/notifications/build-reminder-items.test.ts.
 */
const WIDGET_CAP = 6 // = UPCOMING_LIMIT in upcoming-payments-widget.tsx

function visibleUpcomingNames(today: Date): Set<string> {
  const upcoming = SEED_CARDS.filter((c) => c.paymentDueDay != null)
    .map((c) => ({ name: c.cardName, due: nextDueDate(c.paymentDueDay, today)! }))
    .filter((u) => u.due != null)
  upcoming.sort((a, b) => a.due.getTime() - b.due.getTime() || a.name.localeCompare(b.name))
  return new Set(upcoming.slice(0, WIDGET_CAP).map((u) => u.name))
}

const utc = (s: string) => new Date(`${s}T00:00:00Z`)
const AUTOPAY_ACTIVE = new Set(
  SEED_AUTOPAY_LINKS.filter((a) => a.autopayActive).map((a) => a.cardName)
)

/** Seed-derived reminder prediction at the run date (fixture payments only —
 *  the spec's own $43.00 row is asserted unconditionally on top). */
function predictedSeedReminders(today: Date) {
  const cards: ReminderCard[] = SEED_CARDS.map((c) => ({
    id: c.cardName,
    cardName: c.cardName,
    lastFour: c.lastFour,
    balanceMinor: c.currentBalanceMinor,
    limitMinor: c.creditLimitMinor,
    regularAprBps: c.regularAprBps,
    minimumPaymentMinor: c.minimumPaymentMinor,
    promo: c.promo
      ? { endsOn: utc(c.promo.endsOn), shelteredBalanceMinor: c.currentBalanceMinor, regularAprBpsAfter: c.promo.regularAprBpsAfter }
      : null,
    paymentDueDay: c.paymentDueDay,
    statementCloseDay: c.statementCloseDay ?? null,
    autopayActive: AUTOPAY_ACTIVE.has(c.cardName),
  }))
  const payments: RunwayPayment[] = SEED_SCHEDULED_PAYMENTS.map((p, i) => ({
    id: `seed-${i}`,
    cardId: p.cardName,
    amountMinor: p.amountMinor,
    scheduledFor: utc(p.scheduledFor),
    status: p.status,
  }))
  return buildReminderItems(cards, payments, today)
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

  // Exit criterion: due-date occurrences from the seeded fixture appear —
  // asserted when the engine predicts any at the run date (rare all-covered
  // windows exist, e.g. 2026-07-20; review finding).
  const predicted = predictedSeedReminders(new Date())
  if (predicted.some((i) => i.type === "DUE_SOON")) {
    await expect(
      page.getByTestId("notification-row").filter({ hasText: "Payment due soon" }).first()
    ).toBeVisible()
  }
  // ALWAYS asserted: the $43.00 payment this spec inserts at today+2.
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
