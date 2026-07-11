/**
 * Recurring Charge Detection
 *
 * Detects subscriptions and other recurring charges from transaction history.
 * Pure compute-on-read — groups transactions by normalized merchant, then
 * classifies groups whose intervals and amounts are consistent. No schema
 * changes or background jobs required.
 */

import { prisma } from '@/lib/db/prisma';

export type RecurringCadence = 'weekly' | 'biweekly' | 'monthly' | 'annual';

export interface RecurringCharge {
  /** Display name (most common raw merchant/description in the group) */
  merchant: string;
  category: string;
  cadence: RecurringCadence;
  /** Average charge amount as a positive number */
  averageAmount: number;
  /** Date of the most recent charge */
  lastDate: Date;
  /** Projected next charge date (lastDate + median interval) */
  nextExpectedDate: Date;
  /** Number of occurrences observed */
  occurrences: number;
  /** 0–1: how consistent the interval and amount are */
  confidence: number;
}

interface CadenceSpec {
  cadence: RecurringCadence;
  days: number;
}

// Ordered by interval length; matched with ±20% tolerance
const CADENCES: CadenceSpec[] = [
  { cadence: 'weekly', days: 7 },
  { cadence: 'biweekly', days: 14 },
  { cadence: 'monthly', days: 30 },
  { cadence: 'annual', days: 365 },
];

const INTERVAL_TOLERANCE = 0.2;
const AMOUNT_TOLERANCE = 0.15;
const MIN_OCCURRENCES = 3;

/**
 * Normalize a merchant string into a grouping key: lowercase, strip store
 * numbers / trailing digits / punctuation so "STARBUCKS #1234" and
 * "STARBUCKS #98" group together.
 */
export function normalizeMerchantKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/#\s*\d+/g, '')
    .replace(/\d{3,}/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

interface TxnLike {
  merchant: string | null;
  description: string;
  category: string;
  amount: number;
  date: Date;
}

/**
 * Detect recurring charges from a list of expense transactions.
 * Exposed for testing; most callers want getRecurringCharges(userId).
 */
export function detectRecurringCharges(transactions: TxnLike[]): RecurringCharge[] {
  // Group by normalized merchant key (expenses only)
  const groups = new Map<string, TxnLike[]>();
  for (const txn of transactions) {
    if (txn.amount >= 0) continue; // expenses are negative
    const raw = txn.merchant || txn.description;
    if (!raw) continue;
    const key = normalizeMerchantKey(raw);
    if (!key) continue;
    const group = groups.get(key);
    if (group) {
      group.push(txn);
    } else {
      groups.set(key, [txn]);
    }
  }

  const results: RecurringCharge[] = [];

  for (const txns of groups.values()) {
    if (txns.length < MIN_OCCURRENCES) continue;

    const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Intervals between consecutive charges, in days
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (!prev || !curr) continue;
      intervals.push((curr.date.getTime() - prev.date.getTime()) / 86_400_000);
    }
    if (intervals.length === 0) continue;

    const medianInterval = median(intervals);
    const spec = CADENCES.find(
      (c) => Math.abs(medianInterval - c.days) <= c.days * INTERVAL_TOLERANCE
    );
    if (!spec) continue;

    // Interval consistency: fraction of intervals within tolerance of the cadence
    const intervalHits = intervals.filter(
      (iv) => Math.abs(iv - spec.days) <= spec.days * INTERVAL_TOLERANCE
    ).length;
    const intervalScore = intervalHits / intervals.length;
    if (intervalScore < 0.5) continue;

    // Amount consistency: fraction of amounts within tolerance of the median
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const medianAmount = median(amounts);
    const amountHits = amounts.filter(
      (a) => Math.abs(a - medianAmount) <= Math.max(medianAmount * AMOUNT_TOLERANCE, 1)
    ).length;
    const amountScore = amountHits / amounts.length;

    const last = sorted[sorted.length - 1];
    if (!last) continue;

    // Most common raw merchant string for display
    const nameCounts = new Map<string, number>();
    for (const t of sorted) {
      const name = t.merchant || t.description;
      nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    }
    const displayName =
      [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      last.merchant ??
      last.description;

    results.push({
      merchant: displayName,
      category: last.category,
      cadence: spec.cadence,
      averageAmount: Math.round((amounts.reduce((s, a) => s + a, 0) / amounts.length) * 100) / 100,
      lastDate: last.date,
      nextExpectedDate: new Date(last.date.getTime() + medianInterval * 86_400_000),
      occurrences: sorted.length,
      confidence: Math.round(intervalScore * amountScore * 100) / 100,
    });
  }

  // Highest monthly cost first
  return results.sort((a, b) => monthlyCost(b) - monthlyCost(a));
}

/** Approximate monthly cost of a recurring charge. */
export function monthlyCost(charge: RecurringCharge): number {
  switch (charge.cadence) {
    case 'weekly':
      return charge.averageAmount * (30 / 7);
    case 'biweekly':
      return charge.averageAmount * (30 / 14);
    case 'monthly':
      return charge.averageAmount;
    case 'annual':
      return charge.averageAmount / 12;
  }
}

/**
 * Fetch a user's transactions (last 13 months) and detect recurring charges.
 */
export async function getRecurringCharges(userId: string): Promise<RecurringCharge[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 13);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      date: { gte: since },
    },
    select: {
      merchant: true,
      description: true,
      category: true,
      amount: true,
      date: true,
    },
    orderBy: { date: 'asc' },
  });

  return detectRecurringCharges(
    transactions.map((t) => ({ ...t, amount: Number(t.amount) }))
  );
}
