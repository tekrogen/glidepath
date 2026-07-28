/**
 * Pure account-link planning for the PlaidAccount identity spine (issue #107).
 *
 * Decides, per Plaid account, how it maps to a local UserAccount. The only
 * durable matching key is Plaid's stable `account_id`. Masks appear in exactly
 * one place: the one-time adoption backfill for accounts created before the
 * spine existed — and adoption is refused when the mask is ambiguous, because
 * real portfolios (and the seed, intentionally) contain duplicate last-fours.
 *
 * Pure by design: no I/O, no Prisma. The service layer executes the plan.
 */

export interface PlannedPlaidAccount {
  /** Plaid's stable account_id. */
  accountId: string;
  /** Display mask formatted as stored locally, e.g. "...1234". */
  mask: string;
}

export interface ExistingLink {
  accountId: string;
  userAccountId: string | null;
}

export interface LocalAccountCandidate {
  id: string;
  /** Stored display mask ("...1234") or null. */
  accountNumber: string | null;
  /** True when some PlaidAccount row already claims this local account. */
  claimed: boolean;
}

export type LinkAction =
  /** Link exists and points at a local account — update that account in place. */
  | { kind: 'update'; accountId: string; userAccountId: string }
  /**
   * Pre-spine local account matched by mask exactly once among unclaimed
   * candidates — adopt it and pin the link by account_id.
   */
  | { kind: 'adopt'; accountId: string; userAccountId: string }
  /** No link target and no unambiguous adoption — create a fresh local account. */
  | { kind: 'create'; accountId: string };

/**
 * Plan link actions for one Plaid item's accounts.
 *
 * Adoption rules (backfill only — never a steady-state path):
 * - only when no PlaidAccount row exists for the account_id;
 * - only when exactly ONE unclaimed local account carries the mask;
 * - a candidate adopted earlier in the same plan is no longer available,
 *   so two Plaid accounts sharing a mask can never adopt the same row —
 *   the second one falls through to `create`.
 */
export function planAccountLinks(
  plaidAccounts: PlannedPlaidAccount[],
  links: ExistingLink[],
  candidates: LocalAccountCandidate[]
): LinkAction[] {
  const linkByAccountId = new Map(links.map((l) => [l.accountId, l]));
  const adoptedThisPlan = new Set<string>();

  const availableByMask = (mask: string): LocalAccountCandidate[] =>
    candidates.filter(
      (c) => !c.claimed && !adoptedThisPlan.has(c.id) && c.accountNumber === mask
    );

  return plaidAccounts.map((acct): LinkAction => {
    const link = linkByAccountId.get(acct.accountId);

    if (link?.userAccountId) {
      return { kind: 'update', accountId: acct.accountId, userAccountId: link.userAccountId };
    }

    // No usable link (absent, or severed by SetNull when the local account
    // was deleted). A severed link never re-adopts by mask — the user removed
    // that account; recreate cleanly.
    if (!link) {
      const matches = availableByMask(acct.mask);
      if (matches.length === 1) {
        adoptedThisPlan.add(matches[0].id);
        return { kind: 'adopt', accountId: acct.accountId, userAccountId: matches[0].id };
      }
    }

    return { kind: 'create', accountId: acct.accountId };
  });
}

/** Display mask exactly as stored on UserAccount.accountNumber. */
export function formatPlaidMask(account: { mask?: string | null; account_id: string }): string {
  return account.mask ? `...${account.mask}` : `...${account.account_id.slice(-4)}`;
}
