/**
 * Monarch balances import — pure aggregation + matching (issue #48).
 * No I/O: dated rows in → per-account snapshots → a match plan against the
 * household's cards. The matcher's tier order IS the spec; balance
 * equality appears NOWHERE (snapshots drift between sources — never a
 * signal). Token similarity ORDERS picker candidates only — it never
 * selects a write target. Update-only: nothing here ever proposes creating
 * a card.
 */
import type { MonarchBalanceRow } from "./monarch-csv"

export interface MonarchAccountSnapshot {
  /** Verbatim Account string — the persisted match key. */
  accountKey: string
  /** Display name with the (...NNNN) suffix removed. */
  displayName: string
  /** Trailing digits from the suffix; null when absent. Never a key alone. */
  suffix: string | null
  /** "four" = 4-digit (may suggest); "short" = 3-digit brokerage form —
   *  display-only, never auto-matches, never contradicts. */
  suffixKind: "four" | "short" | null
  /** yyyy-mm-dd of the newest row for this account. */
  latestDate: string
  /** Signed minor units from that newest row (Monarch's sign). */
  latestBalanceMinor: bigint
  /** Any row in the series was negative — a display heuristic only. */
  everNegative: boolean
  /** The series ends before the file's max date. */
  stale: boolean
  warnings: string[]
}

/**
 * "(...2203)" → 2203/four · "(...XXXX-XXXX-XXXX-6209)" → 6209/four ·
 * "(....955)" → 955/short. Anchored at the END so mid-name digit runs
 * ("Contributory ...955 (....955)") never match early.
 */
export function extractSuffix(
  account: string
): { suffix: string; kind: "four" | "short" } | null {
  const m = /\(\.{3,}[0-9Xx-]*?(\d{3,4})\)\s*$/.exec(account)
  if (!m) return null
  return { suffix: m[1], kind: m[1].length === 4 ? "four" : "short" }
}

function displayNameOf(account: string): string {
  return account.replace(/\s*\(\.{3,}[0-9Xx-]*?\d{3,4}\)\s*$/, "").trim()
}

/**
 * Collapse the daily grid to one snapshot per verbatim account: newest
 * date wins; a duplicate (account, date) pair keeps the LATER physical row
 * and warns. asOfDate = the file-wide max date.
 */
export function aggregateSnapshots(rows: MonarchBalanceRow[]): {
  snapshots: MonarchAccountSnapshot[]
  asOfDate: string | null
} {
  interface Acc {
    latest: MonarchBalanceRow
    everNegative: boolean
    dupDates: boolean
  }
  const byAccount = new Map<string, Acc>()
  for (const row of rows) {
    const acc = byAccount.get(row.account)
    if (!acc) {
      byAccount.set(row.account, {
        latest: row,
        everNegative: row.balanceMinor < 0n,
        dupDates: false,
      })
      continue
    }
    acc.everNegative = acc.everNegative || row.balanceMinor < 0n
    if (row.date > acc.latest.date) acc.latest = row
    else if (row.date === acc.latest.date) {
      // Later physical row wins on an exact duplicate date.
      acc.latest = row
      acc.dupDates = true
    }
  }
  let asOfDate: string | null = null
  for (const { latest } of byAccount.values()) {
    if (asOfDate == null || latest.date > asOfDate) asOfDate = latest.date
  }
  const snapshots = [...byAccount.entries()]
    .map(([accountKey, acc]) => {
      const suffixInfo = extractSuffix(accountKey)
      const warnings: string[] = []
      if (acc.dupDates) {
        warnings.push("Duplicate rows for the same date — the file's later row was used.")
      }
      const stale = asOfDate != null && acc.latest.date < asOfDate
      if (stale) {
        warnings.push(`Series ends ${acc.latest.date} — older than the file's newest data.`)
      }
      return {
        accountKey,
        displayName: displayNameOf(accountKey),
        suffix: suffixInfo?.suffix ?? null,
        suffixKind: suffixInfo?.kind ?? null,
        latestDate: acc.latest.date,
        latestBalanceMinor: acc.latest.balanceMinor,
        everNegative: acc.everNegative,
        stale,
        warnings,
      }
    })
    .sort((a, b) => a.accountKey.localeCompare(b.accountKey))
  return { snapshots, asOfDate }
}

/** Negate Monarch's sign into "positive owed"; clamp a credit balance to 0n. */
export function toOwedMinor(balanceMinor: bigint): {
  owedMinor: bigint
  creditBalance: boolean
} {
  const owed = -balanceMinor
  if (owed < 0n) return { owedMinor: 0n, creditBalance: true }
  return { owedMinor: owed, creditBalance: false }
}

export interface MatchableCard {
  id: string
  cardName: string
  issuer: string
  lastFour: string | null
  currency: string
  monarchAccountKey: string | null
  currentBalanceMinor: bigint
}

export type MatchStatus = "remembered" | "suggested" | "ambiguous" | "unmatched" | "nonCard"

export interface MonarchMatchEntry {
  snapshot: MonarchAccountSnapshot
  status: MatchStatus
  /** Set only for remembered/suggested — the pre-selected write target. */
  cardId: string | null
  /** Picker candidates, best-first. ORDERING ONLY — never selects. */
  rankedCandidateIds: string[]
  owedMinor: bigint
  creditBalanceClamped: boolean
  warnings: string[]
}

export interface MonarchMatchPlan {
  entries: MonarchMatchEntry[]
  asOfDate: string | null
  /** Household cards this export doesn't mention — untouched by the import. */
  cardsNotInFile: MatchableCard[]
}

const tokenize = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .replace(/[®™]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3)
  )

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const t of a) if (b.has(t)) n++
  return n
}

/**
 * The 4-state matcher (+ nonCard grouping). Tier order is the contract:
 *
 * 1. remembered — card.monarchAccountKey === snapshot.accountKey (verbatim).
 * 2. suggested  — BIDIRECTIONAL suffix uniqueness among unclaimed USD cards:
 *    exactly one file account carries suffix S AND exactly one unclaimed
 *    card has lastFour === S (and that card's lastFour matches no other
 *    file suffix). The strongest reading of "never key on last-four alone":
 *    a set-level bijection, not a per-row key.
 * 3. ambiguous  — suffix candidates exist but the bijection fails (the
 *    7727 2×2). Picker required, NO preselection.
 * 4. unmatched  — no candidates at all.
 * 5. nonCard    — never-negative series with no persisted key (display
 *    heuristic; sign never gates matching — clamps and zero-series exist).
 *
 * Candidate exclusions: a card whose lastFour is set and DIFFERS from the
 * row's 4-digit suffix (contradiction rule; "short" suffixes never
 * contradict); non-USD cards (the CSV has no currency column).
 */
export function matchSnapshots(
  snapshots: MonarchAccountSnapshot[],
  cards: MatchableCard[]
): MonarchMatchPlan {
  const usdCards = cards.filter((c) => c.currency === "USD")
  const byKey = new Map<string, MatchableCard>()
  for (const c of cards) {
    if (c.monarchAccountKey != null) byKey.set(c.monarchAccountKey, c)
  }

  // Set-level counts for the bijection test.
  const suffixCountInFile = new Map<string, number>()
  for (const s of snapshots) {
    if (s.suffixKind === "four" && s.suffix) {
      suffixCountInFile.set(s.suffix, (suffixCountInFile.get(s.suffix) ?? 0) + 1)
    }
  }
  const claimedCardIds = new Set(
    snapshots
      .map((s) => byKey.get(s.accountKey)?.id)
      .filter((id): id is string => id != null)
  )
  const unclaimedUsd = usdCards.filter((c) => !claimedCardIds.has(c.id))
  const cardsByLastFour = new Map<string, MatchableCard[]>()
  for (const c of unclaimedUsd) {
    if (c.lastFour) {
      const list = cardsByLastFour.get(c.lastFour) ?? []
      list.push(c)
      cardsByLastFour.set(c.lastFour, list)
    }
  }

  const usedCardIds = new Set<string>(claimedCardIds)
  const mentioned = new Set<string>()

  const entries = snapshots.map((snapshot): MonarchMatchEntry => {
    const { owedMinor, creditBalance } = toOwedMinor(snapshot.latestBalanceMinor)
    const warnings = [...snapshot.warnings]
    if (creditBalance) {
      warnings.push("Monarch shows a credit balance — stored as $0 owed.")
    }

    // Tier 1 — remembered.
    const remembered = byKey.get(snapshot.accountKey)
    if (remembered) {
      mentioned.add(remembered.id)
      if (remembered.currency !== "USD") {
        return {
          snapshot,
          status: "unmatched",
          cardId: null,
          rankedCandidateIds: [],
          owedMinor,
          creditBalanceClamped: creditBalance,
          warnings: [
            ...warnings,
            `Linked card's currency is ${remembered.currency} — balance not imported (the export has no currency column).`,
          ],
        }
      }
      return {
        snapshot,
        status: "remembered",
        cardId: remembered.id,
        rankedCandidateIds: [remembered.id],
        owedMinor,
        creditBalanceClamped: creditBalance,
        warnings,
      }
    }

    // Candidates: unclaimed USD cards not contradicted by a four-suffix.
    const candidates = unclaimedUsd.filter((c) => {
      if (
        snapshot.suffixKind === "four" &&
        snapshot.suffix != null &&
        c.lastFour != null &&
        c.lastFour !== snapshot.suffix
      ) {
        return false
      }
      return true
    })

    // Tier 2 — bidirectional suffix uniqueness.
    if (snapshot.suffixKind === "four" && snapshot.suffix) {
      const suffixCards = cardsByLastFour.get(snapshot.suffix) ?? []
      if (
        suffixCountInFile.get(snapshot.suffix) === 1 &&
        suffixCards.length === 1 &&
        !usedCardIds.has(suffixCards[0].id)
      ) {
        const card = suffixCards[0]
        usedCardIds.add(card.id)
        mentioned.add(card.id)
        // Suffix-agreeing candidates first, then token overlap, for the picker.
        const ranked = rankCandidates(snapshot, candidates, card.id)
        return {
          snapshot,
          status: "suggested",
          cardId: card.id,
          rankedCandidateIds: ranked,
          owedMinor,
          creditBalanceClamped: creditBalance,
          warnings,
        }
      }
    }

    // Tier 3/4 — candidates exist ⇒ ambiguous (picker, no preselection);
    // none ⇒ unmatched, unless the series never went negative (nonCard).
    const suffixCandidates =
      snapshot.suffixKind === "four" && snapshot.suffix
        ? candidates.filter((c) => c.lastFour === snapshot.suffix)
        : []
    const hasSignals = suffixCandidates.length > 0
    if (!hasSignals && !snapshot.everNegative) {
      return {
        snapshot,
        status: "nonCard",
        cardId: null,
        rankedCandidateIds: rankCandidates(snapshot, candidates, null),
        owedMinor,
        creditBalanceClamped: creditBalance,
        warnings,
      }
    }
    return {
      snapshot,
      status: hasSignals ? "ambiguous" : "unmatched",
      cardId: null,
      rankedCandidateIds: rankCandidates(snapshot, candidates, null),
      owedMinor,
      creditBalanceClamped: creditBalance,
      warnings,
    }
  })

  const cardsNotInFile = cards.filter((c) => {
    const target = entries.find((e) => e.cardId === c.id)
    return target == null
  })

  return { entries, asOfDate: snapshots[0] ? maxDate(snapshots) : null, cardsNotInFile }
}

function maxDate(snapshots: MonarchAccountSnapshot[]): string {
  return snapshots.reduce((max, s) => (s.latestDate > max ? s.latestDate : max), snapshots[0].latestDate)
}

/** Suffix-agreeing first, then token overlap with cardName+issuer. Display order only. */
function rankCandidates(
  snapshot: MonarchAccountSnapshot,
  candidates: MatchableCard[],
  pinnedFirst: string | null
): string[] {
  const nameTokens = tokenize(snapshot.displayName)
  const scored = candidates.map((c) => ({
    id: c.id,
    suffixAgrees:
      snapshot.suffixKind === "four" && snapshot.suffix != null && c.lastFour === snapshot.suffix
        ? 1
        : 0,
    overlap: tokenOverlap(nameTokens, tokenize(`${c.cardName} ${c.issuer}`)),
  }))
  scored.sort(
    (a, b) => b.suffixAgrees - a.suffixAgrees || b.overlap - a.overlap || a.id.localeCompare(b.id)
  )
  const ids = scored.map((s) => s.id)
  if (pinnedFirst) {
    return [pinnedFirst, ...ids.filter((id) => id !== pinnedFirst)]
  }
  return ids
}
