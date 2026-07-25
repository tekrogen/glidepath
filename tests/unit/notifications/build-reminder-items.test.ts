/**
 * Reminder builder (issue #46 exit criterion: "notification occurrences
 * appear for upcoming due dates in the seeded fixture"). Anchored to the
 * SEED_VERSION 3 fixture — the seed IS the fixture: uncovered dues inside
 * the DUE_SOON window notify per occurrence; a claiming scheduled payment
 * or confirmed provider autopay silences them; imminent planned payments
 * remind within their own shorter lead.
 */
import { describe, expect, it } from "vitest"

import type { RunwayPayment } from "@/lib/finance"
import {
  buildReminderItems,
  PAYMENT_REMINDER_LEAD_DAYS,
  type ReminderCard,
} from "@/features/notifications/utils/build-reminder-items"
import { SEED_CARDS } from "../../../prisma/seed-data/glidepath-cards"
import {
  SEED_AUTOPAY_LINKS,
  SEED_SCHEDULED_PAYMENTS,
} from "../../../prisma/seed-data/glidepath-payments"

const utc = (s: string) => new Date(`${s}T00:00:00Z`)

const AUTOPAY_ACTIVE = new Set(
  SEED_AUTOPAY_LINKS.filter((a) => a.autopayActive).map((a) => a.cardName)
)

const cards: ReminderCard[] = SEED_CARDS.map((c) => ({
  id: c.cardName, // name-as-id keeps assertions readable; ids are opaque to the builder
  cardName: c.cardName,
  lastFour: c.lastFour,
  balanceMinor: c.currentBalanceMinor,
  limitMinor: c.creditLimitMinor,
  regularAprBps: c.regularAprBps,
  minimumPaymentMinor: c.minimumPaymentMinor,
  promo: c.promo
    ? {
        endsOn: utc(c.promo.endsOn),
        shelteredBalanceMinor: c.currentBalanceMinor,
        regularAprBpsAfter: c.promo.regularAprBpsAfter,
      }
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

describe("buildReminderItems — seeded fixture", () => {
  it("fixture anchor 2026-07-11: exactly the uncovered in-window dues notify", () => {
    const items = buildReminderItems(cards, payments, utc("2026-07-11"))
    const dueKeys = items.filter((i) => i.type === "DUE_SOON").map((i) => i.dedupeKey).sort()
    // Window [0,7] inclusive: Summit Travel due 7-11 (today), Juniper +
    // Pinnacle due 7-15, Harbor Business due 7-18 (exactly 7d). Quill's
    // 7-09 has passed (next is Aug); nothing in-window is covered.
    expect(dueKeys).toEqual([
      "DUE_SOON:card:Harbor Business:2026-07-18",
      "DUE_SOON:card:Juniper Retail:2026-07-15",
      "DUE_SOON:card:Pinnacle Visa:2026-07-15",
      "DUE_SOON:card:Summit Travel:2026-07-11",
    ])
    // Fixture payments are all >3d out at the anchor — no payment reminders.
    expect(items.filter((i) => i.type === "PAYMENT_REMINDER")).toEqual([])
  })

  it("a claiming scheduled payment silences the due and reminds about itself", () => {
    const items = buildReminderItems(cards, payments, utc("2026-07-20"))
    // Meridian's 7-22 due is claimed by the $85 payment on 7-22 → no DUE_SOON…
    expect(items.some((i) => i.type === "DUE_SOON" && i.dedupeKey.includes("Meridian"))).toBe(false)
    // …but the planned payment itself is 2 days out → PAYMENT_REMINDER.
    const reminder = items.find((i) => i.type === "PAYMENT_REMINDER" && i.body.includes("Meridian"))
    expect(reminder).toBeDefined()
    expect(reminder!.title).toBe("Planned payment in 2 days")
    expect(reminder!.body).toContain("$85.00")
    expect(reminder!.href).toBe("/payments")
  })

  it("confirmed provider autopay silences dues entirely (EDR-016)", () => {
    // 2026-07-25: Beacon Everyday (due day 27, autopayActive) is 2d out.
    const items = buildReminderItems(cards, payments, utc("2026-07-25"))
    expect(items.some((i) => i.dedupeKey.includes("Beacon"))).toBe(false)
    // Aspen One (due day 28, no autopay, no min recorded) still notifies.
    expect(
      items.some((i) => i.dedupeKey === "DUE_SOON:card:Aspen One:2026-07-28")
    ).toBe(true)
  })

  it("payment reminders respect the lead window and skip resolved rows", () => {
    expect(PAYMENT_REMINDER_LEAD_DAYS).toBe(3)
    // 2026-07-08: Quill's DONE payment (7-09) is 1d out but resolved → no reminder.
    const items = buildReminderItems(cards, payments, utc("2026-07-08"))
    expect(items.filter((i) => i.type === "PAYMENT_REMINDER")).toEqual([])
  })

  it("dedupeKeys match the attention builder's shape exactly", () => {
    const items = buildReminderItems(cards, payments, utc("2026-07-11"))
    for (const i of items.filter((x) => x.type === "DUE_SOON")) {
      expect(i.dedupeKey).toMatch(/^DUE_SOON:card:.+:\d{4}-\d{2}-\d{2}$/)
    }
  })
})
