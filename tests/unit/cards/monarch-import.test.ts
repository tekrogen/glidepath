/**
 * Monarch aggregation + matching (issue #48) — the core risk file. Pins:
 * latest-per-account, duplicate-date last-wins, staleness; the three
 * suffix variants; the 4-state matcher's tier order with BIDIRECTIONAL
 * suffix uniqueness (the 7727 2×2 must be ambiguous with no preselection);
 * the contradiction rule; the balance-equality trap (a wrong card whose
 * balance equals the CSV value must never be chosen); currency and FROZEN
 * semantics; sign clamp.
 */
import { describe, expect, it } from "vitest"

import {
  aggregateSnapshots,
  extractSuffix,
  matchSnapshots,
  toOwedMinor,
  type MatchableCard,
  type MonarchAccountSnapshot,
} from "@/features/cards/server/monarch-import"

const row = (date: string, balance: bigint, account: string) => ({
  date,
  balanceMinor: balance,
  account,
})

const card = (over: Partial<MatchableCard> & { id: string }): MatchableCard => ({
  cardName: "Card",
  issuer: "Bank",
  lastFour: null,
  currency: "USD",
  monarchAccountKey: null,
  currentBalanceMinor: 0n,
  ...over,
})

const snap = (over: Partial<MonarchAccountSnapshot> & { accountKey: string }): MonarchAccountSnapshot => ({
  displayName: over.accountKey,
  suffix: null,
  suffixKind: null,
  latestDate: "2026-07-17",
  latestBalanceMinor: -1000n,
  everNegative: true,
  stale: false,
  warnings: [],
  ...over,
})

describe("aggregateSnapshots", () => {
  it("newest per account; duplicate of the USED date → later physical row + warning; stale flag", () => {
    const { snapshots, asOfDate } = aggregateSnapshots([
      row("2026-07-16", -100n, "A (...1111)"),
      row("2026-07-17", -200n, "A (...1111)"),
      row("2026-07-17", -300n, "A (...1111)"), // dup of the used date — later row wins
      row("2026-07-10", -50n, "Old (...2222)"), // ends early — stale
    ])
    expect(asOfDate).toBe("2026-07-17")
    const a = snapshots.find((s) => s.accountKey === "A (...1111)")!
    expect(a.latestBalanceMinor).toBe(-300n)
    expect(a.warnings.some((w) => w.includes("Duplicate rows for 2026-07-17"))).toBe(true)
    const old = snapshots.find((s) => s.accountKey === "Old (...2222)")!
    expect(old.stale).toBe(true)
  })

  it("duplicate detection is ORDER-INDEPENDENT (review finding): newest-first files still warn", () => {
    // Newest-first order — the old running-latest comparison missed this.
    const { snapshots } = aggregateSnapshots([
      row("2026-07-17", -100n, "A (...1111)"),
      row("2026-07-17", -150n, "A (...1111)"), // dup of the used date, later row wins
      row("2026-07-16", -200n, "A (...1111)"),
    ])
    const a = snapshots[0]
    expect(a.latestBalanceMinor).toBe(-150n)
    expect(a.warnings.some((w) => w.includes("Duplicate rows for 2026-07-17"))).toBe(true)
  })

  it("superseded duplicates (not the used date) stay silent — they can't affect the figure", () => {
    const { snapshots } = aggregateSnapshots([
      row("2026-07-16", -200n, "A (...1111)"),
      row("2026-07-16", -300n, "A (...1111)"), // dup, but superseded by 07-17
      row("2026-07-17", -100n, "A (...1111)"),
    ])
    const a = snapshots[0]
    expect(a.latestBalanceMinor).toBe(-100n)
    expect(a.warnings).toEqual([])
  })
})

describe("extractSuffix", () => {
  it("all three fixture variants; mid-name digit runs never match", () => {
    expect(extractSuffix("USAA CLASSIC CHECKING (...2203)")).toEqual({ suffix: "2203", kind: "four" })
    expect(extractSuffix("PLATINUM CARD (...XXXX-XXXX-XXXX-6209)")).toEqual({ suffix: "6209", kind: "four" })
    expect(extractSuffix("Contributory ...955 (....955)")).toEqual({ suffix: "955", kind: "short" })
    expect(extractSuffix("CREDIT CARD (...0037)")).toEqual({ suffix: "0037", kind: "four" })
    expect(extractSuffix("No Suffix")).toBeNull()
  })
})

describe("toOwedMinor", () => {
  it("negates Monarch's sign; clamps credit balances to 0n", () => {
    expect(toOwedMinor(-57886n)).toEqual({ owedMinor: 57886n, creditBalance: false })
    expect(toOwedMinor(13886n)).toEqual({ owedMinor: 0n, creditBalance: true })
    expect(toOwedMinor(0n)).toEqual({ owedMinor: 0n, creditBalance: false })
  })
})

describe("matchSnapshots — tier order", () => {
  it("remembered beats everything and claims the card", () => {
    const c = card({ id: "c1", monarchAccountKey: "Quicksilver (...8391)", lastFour: "8391" })
    const plan = matchSnapshots(
      [snap({ accountKey: "Quicksilver (...8391)", suffix: "8391", suffixKind: "four" })],
      [c]
    )
    expect(plan.entries[0].status).toBe("remembered")
    expect(plan.entries[0].cardId).toBe("c1")
  })

  it("suggested requires BIDIRECTIONAL uniqueness — the 7727 2×2 is ambiguous with NO preselection", () => {
    const amazon = snap({ accountKey: "Amazon CREDIT CARD (...7727)", suffix: "7727", suffixKind: "four" })
    const bestbuy = snap({ accountKey: "My Best Buy® Visa® Card (...7727)", suffix: "7727", suffixKind: "four" })
    const c1 = card({ id: "c1", cardName: "Horizon Cash", lastFour: "7727" })
    const c2 = card({ id: "c2", cardName: "Cedar Line", lastFour: "7727" })
    const plan = matchSnapshots([amazon, bestbuy], [c1, c2])
    for (const entry of plan.entries) {
      expect(entry.status).toBe("ambiguous")
      expect(entry.cardId).toBeNull() // never preselected
      expect(entry.rankedCandidateIds).toHaveLength(2)
    }
  })

  it("one account × one card with a unique suffix ⇒ suggested", () => {
    const plan = matchSnapshots(
      [snap({ accountKey: "Fern (...8391)", suffix: "8391", suffixKind: "four" })],
      [card({ id: "c1", lastFour: "8391" }), card({ id: "c2", lastFour: "1111" })]
    )
    expect(plan.entries[0].status).toBe("suggested")
    expect(plan.entries[0].cardId).toBe("c1")
  })

  it("contradiction rule: a card whose lastFour differs is excluded from candidates", () => {
    const plan = matchSnapshots(
      [snap({ accountKey: "X (...9999)", suffix: "9999", suffixKind: "four" })],
      [card({ id: "c1", lastFour: "1111" })]
    )
    expect(plan.entries[0].status).toBe("unmatched")
    expect(plan.entries[0].rankedCandidateIds).toEqual([])
  })

  it("short suffixes never suggest and never contradict", () => {
    const plan = matchSnapshots(
      [snap({ accountKey: "Contributory ...955 (....955)", suffix: "955", suffixKind: "short", everNegative: false })],
      [card({ id: "c1", lastFour: "0955" })]
    )
    expect(plan.entries[0].status).toBe("nonCard") // never-negative, no signals
    expect(plan.entries[0].rankedCandidateIds).toContain("c1") // still pickable
  })

  it("BALANCE-EQUALITY TRAP: an exact balance match can neither select nor break a tie", () => {
    // Strengthened per review finding — the trap must sit where balance
    // equality WOULD decide if it were consulted at all:
    // (a) tie-break: two candidates share the suffix; one's balance equals
    //     the CSV value exactly. If equality were a signal, that card would
    //     be preselected — it must stay ambiguous with NO preselection.
    const equal = card({ id: "equal", cardName: "Equal", lastFour: "7727", currentBalanceMinor: 316628n })
    const other = card({ id: "other", cardName: "Other", lastFour: "7727", currentBalanceMinor: 1n })
    const tie = matchSnapshots(
      [snap({ accountKey: "My Best Buy® Visa® Card (...7727)", suffix: "7727", suffixKind: "four", latestBalanceMinor: -316628n })],
      [equal, other]
    )
    expect(tie.entries[0].status).toBe("ambiguous")
    expect(tie.entries[0].cardId).toBeNull()
    // (b) selection: a suffix-contradicted card with the equal balance must
    //     stay excluded — equality never resurrects a candidate.
    const trap = card({ id: "trap", cardName: "Wrong Card", lastFour: "9034", currentBalanceMinor: 316628n })
    const excl = matchSnapshots(
      [snap({ accountKey: "My Best Buy® Visa® Card (...7727)", suffix: "7727", suffixKind: "four", latestBalanceMinor: -316628n })],
      [trap]
    )
    expect(excl.entries[0].status).toBe("unmatched")
    expect(excl.entries[0].cardId).toBeNull()
    expect(excl.entries[0].rankedCandidateIds).toEqual([])
  })

  it("a remembered non-USD card is file-referenced — never listed as 'Not in this export'", () => {
    const linkedEur = card({ id: "c1", currency: "EUR", monarchAccountKey: "Fern (...8391)" })
    const plan = matchSnapshots([snap({ accountKey: "Fern (...8391)" })], [linkedEur])
    expect(plan.entries[0].status).toBe("unmatched") // demoted for currency
    expect(plan.cardsNotInFile).toEqual([]) // but referenced by the file (review finding)
  })

  it("non-USD cards are excluded from suggestion; a remembered non-USD link demotes with a warning", () => {
    const eur = card({ id: "c1", lastFour: "8391", currency: "EUR" })
    const plan1 = matchSnapshots(
      [snap({ accountKey: "Fern (...8391)", suffix: "8391", suffixKind: "four" })],
      [eur]
    )
    expect(plan1.entries[0].status).toBe("unmatched")

    const linkedEur = card({ id: "c2", currency: "EUR", monarchAccountKey: "Fern (...8391)" })
    const plan2 = matchSnapshots([snap({ accountKey: "Fern (...8391)" })], [linkedEur])
    expect(plan2.entries[0].status).toBe("unmatched")
    expect(plan2.entries[0].warnings.some((w) => w.includes("currency is EUR"))).toBe(true)
  })

  it("never-negative unmatched series groups as nonCard; negative series stays unmatched", () => {
    const bank = snap({ accountKey: "USAA CLASSIC CHECKING (...2203)", suffix: "2203", suffixKind: "four", latestBalanceMinor: 175539n, everNegative: false })
    const orphanCard = snap({ accountKey: "Orphan (...0042)", suffix: "0042", suffixKind: "four", latestBalanceMinor: -500n, everNegative: true })
    const plan = matchSnapshots([bank, orphanCard], [])
    expect(plan.entries.find((e) => e.snapshot.accountKey.startsWith("USAA"))!.status).toBe("nonCard")
    expect(plan.entries.find((e) => e.snapshot.accountKey.startsWith("Orphan"))!.status).toBe("unmatched")
  })

  it("cardsNotInFile lists untouched household cards", () => {
    const c1 = card({ id: "c1", lastFour: "8391" })
    const absent = card({ id: "c2", cardName: "Absent", lastFour: "0001" })
    const plan = matchSnapshots(
      [snap({ accountKey: "Fern (...8391)", suffix: "8391", suffixKind: "four" })],
      [c1, absent]
    )
    expect(plan.cardsNotInFile.map((c) => c.id)).toEqual(["c2"])
  })

  it("token overlap ORDERS candidates but never selects (status stays ambiguous)", () => {
    const amazonCard = card({ id: "amz", cardName: "Amazon Visa", issuer: "Chase", lastFour: "7727" })
    const bestbuyCard = card({ id: "bby", cardName: "Best Buy", issuer: "Citibank", lastFour: "7727" })
    const plan = matchSnapshots(
      [
        snap({ accountKey: "Amazon CREDIT CARD (...7727)", displayName: "Amazon CREDIT CARD", suffix: "7727", suffixKind: "four" }),
        snap({ accountKey: "My Best Buy® Visa® Card (...7727)", displayName: "My Best Buy® Visa® Card", suffix: "7727", suffixKind: "four" }),
      ],
      [amazonCard, bestbuyCard]
    )
    const amazonEntry = plan.entries.find((e) => e.snapshot.accountKey.startsWith("Amazon"))!
    expect(amazonEntry.status).toBe("ambiguous")
    expect(amazonEntry.cardId).toBeNull()
    expect(amazonEntry.rankedCandidateIds[0]).toBe("amz") // ordering only
    const bbEntry = plan.entries.find((e) => e.snapshot.accountKey.startsWith("My Best"))!
    expect(bbEntry.rankedCandidateIds[0]).toBe("bby")
  })

  it("FROZEN semantics live upstream: matcher takes any card row it is given (freeze is spend intent, balances still move)", () => {
    // The matcher has no lifecycle input by design — this anchors that the
    // MatchableCard shape carries no lifecycle gate to regress on.
    const c = card({ id: "c1", lastFour: "8391" })
    const plan = matchSnapshots(
      [snap({ accountKey: "Fern (...8391)", suffix: "8391", suffixKind: "four" })],
      [c]
    )
    expect(plan.entries[0].status).toBe("suggested")
  })
})
