/**
 * Demo Seed
 *
 * Creates the demo user with ~9 months of realistic credit-card data:
 * categories, accounts, deterministic transactions (seeded PRNG — same data
 * every run), current-month budgets, and starter insights.
 *
 * Idempotent: transactions upsert by importSource ("demo_<n>"), everything
 * else upserts by natural key. Run with: pnpm db:seed
 */

import { PrismaClient, UserRole, AccountType, TransactionType, BudgetPeriod } from '@prisma/client';
import { initializeCategories } from '../src/lib/categories-init';
import { categorizeTransaction } from '../src/lib/categories';
import { SEED_CARDS, SEED_HOUSEHOLD, SEED_VERSION } from './seed-data/glidepath-cards';
import {
  SEED_AUTOPAY_LINKS,
  SEED_FINANCIAL_ACCOUNTS,
  SEED_SCHEDULED_PAYMENTS,
  SEED_STATEMENTS,
} from './seed-data/glidepath-payments';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@glidepath.cards';
const EMPTY_EMAIL = 'empty@glidepath.cards';
const MONTHS_OF_HISTORY = 9;

// Deterministic PRNG (mulberry32) — fixed seed so re-seeds are stable
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260706);

function jitter(base: number, pct: number): number {
  return Math.round(base * (1 + (rand() * 2 - 1) * pct) * 100) / 100;
}

interface MerchantSpec {
  merchant: string;
  base: number; // typical charge (positive; stored negated)
  account: 'rewards' | 'cashback';
  /** 'monthly' = subscription on a fixed day; 'weekly'; or per-month frequency range */
  pattern: { kind: 'monthly'; day: number } | { kind: 'weekly'; day: number } | { kind: 'random'; min: number; max: number };
  amountJitter: number; // 0 = fixed (subscriptions), else fraction
}

const MERCHANTS: MerchantSpec[] = [
  // Subscriptions — fixed amounts and days so recurring detection finds them
  { merchant: 'NETFLIX.COM', base: 15.49, account: 'rewards', pattern: { kind: 'monthly', day: 3 }, amountJitter: 0 },
  { merchant: 'SPOTIFY USA', base: 11.99, account: 'rewards', pattern: { kind: 'monthly', day: 7 }, amountJitter: 0 },
  { merchant: 'APPLE.COM/BILL', base: 2.99, account: 'cashback', pattern: { kind: 'monthly', day: 12 }, amountJitter: 0 },
  { merchant: 'HULU', base: 17.99, account: 'cashback', pattern: { kind: 'monthly', day: 15 }, amountJitter: 0 },
  { merchant: 'PLANET FITNESS', base: 24.99, account: 'cashback', pattern: { kind: 'monthly', day: 1 }, amountJitter: 0 },
  // Weekly-ish patterns
  { merchant: 'WHOLE FOODS MARKET', base: 87, account: 'rewards', pattern: { kind: 'weekly', day: 6 }, amountJitter: 0.3 },
  { merchant: 'STARBUCKS #4821', base: 6.75, account: 'rewards', pattern: { kind: 'random', min: 6, max: 10 }, amountJitter: 0.25 },
  // Everyday spend
  { merchant: 'SHELL OIL', base: 48, account: 'cashback', pattern: { kind: 'random', min: 3, max: 5 }, amountJitter: 0.2 },
  { merchant: 'CHIPOTLE ONLINE', base: 14.5, account: 'rewards', pattern: { kind: 'random', min: 2, max: 4 }, amountJitter: 0.15 },
  { merchant: 'DOORDASH', base: 32, account: 'rewards', pattern: { kind: 'random', min: 2, max: 5 }, amountJitter: 0.35 },
  { merchant: 'AMAZON MKTPLACE', base: 41, account: 'cashback', pattern: { kind: 'random', min: 3, max: 7 }, amountJitter: 0.6 },
  { merchant: 'TARGET', base: 63, account: 'cashback', pattern: { kind: 'random', min: 1, max: 3 }, amountJitter: 0.4 },
  { merchant: 'CVS PHARMACY', base: 22, account: 'cashback', pattern: { kind: 'random', min: 1, max: 2 }, amountJitter: 0.3 },
  { merchant: 'UBER TRIP', base: 18, account: 'rewards', pattern: { kind: 'random', min: 2, max: 6 }, amountJitter: 0.45 },
  { merchant: 'AMC THEATRES', base: 34, account: 'rewards', pattern: { kind: 'random', min: 0, max: 2 }, amountJitter: 0.2 },
];

// Occasional travel spikes (a couple per year)
const TRAVEL_MERCHANTS = [
  { merchant: 'UNITED AIRLINES', base: 420 },
  { merchant: 'MARRIOTT HOTELS', base: 380 },
  { merchant: 'AIRBNB', base: 290 },
];

async function main() {
  console.log('Seeding demo data...');

  // 1. Categories first — transactions reference them by name
  await initializeCategories();

  // 2. Demo user
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Demo User',
      role: UserRole.USER,
      emailVerified: new Date(),
    },
  });

  // 2b. Empty-state fixture (issue #29): a bare user with NO household
  //     membership, so the first-run / empty states render. Never gets cards.
  await prisma.user.upsert({
    where: { email: EMPTY_EMAIL },
    update: {},
    create: {
      email: EMPTY_EMAIL,
      name: 'Fresh User',
      role: UserRole.USER,
      emailVerified: new Date(),
    },
  });

  // 3. Accounts: two credit cards + a checking account for payments
  async function upsertAccount(
    name: string,
    type: AccountType,
    balance: number,
    institution: string,
    accountNumber: string
  ) {
    const existing = await prisma.userAccount.findFirst({
      where: { userId: user.id, accountNumber },
    });
    if (existing) {
      return prisma.userAccount.update({
        where: { id: existing.id },
        data: { name, type, balance, institution },
      });
    }
    return prisma.userAccount.create({
      data: { userId: user.id, name, type, balance, institution, accountNumber },
    });
  }

  // Credit balance = amount owed (positive), matching Plaid's convention
  const rewards = await upsertAccount('Sapphire Rewards Card', AccountType.CREDIT, 1847.32, 'Chase', '...4242');
  const cashback = await upsertAccount('Everyday Cashback Card', AccountType.CREDIT, 923.18, 'Capital One', '...7391');
  const checking = await upsertAccount('Primary Checking', AccountType.CHECKING, 5210.44, 'Chase', '...1001');

  const accountId = { rewards: rewards.id, cashback: cashback.id } as const;

  // 4. Transactions — 9 months, deterministic
  const now = new Date();
  let txnIndex = 0;
  let created = 0;

  async function upsertTxn(data: {
    accountId: string;
    amount: number;
    description: string;
    merchant: string | null;
    date: Date;
    type: TransactionType;
  }) {
    const { category, subcategory } = categorizeTransaction(
      data.merchant ?? data.description,
      data.amount
    );
    await prisma.transaction.upsert({
      where: { importSource: `demo_${txnIndex}` },
      update: {},
      create: {
        userId: user.id,
        accountId: data.accountId,
        amount: data.amount,
        description: data.description,
        merchant: data.merchant,
        category,
        subcategory,
        date: data.date,
        type: data.type,
        importSource: `demo_${txnIndex}`,
        importBatch: 'demo_seed',
      },
    });
    txnIndex++;
    created++;
  }

  for (let monthsAgo = MONTHS_OF_HISTORY - 1; monthsAgo >= 0; monthsAgo--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    // For the current month, only seed up to today
    const lastDay = monthsAgo === 0 ? now.getDate() : daysInMonth;

    for (const spec of MERCHANTS) {
      const dates: Date[] = [];
      if (spec.pattern.kind === 'monthly') {
        if (spec.pattern.day <= lastDay) {
          dates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), spec.pattern.day));
        }
      } else if (spec.pattern.kind === 'weekly') {
        for (let d = spec.pattern.day; d <= lastDay; d += 7) {
          dates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
        }
      } else {
        const count = spec.pattern.min + Math.floor(rand() * (spec.pattern.max - spec.pattern.min + 1));
        for (let i = 0; i < count; i++) {
          const day = 1 + Math.floor(rand() * lastDay);
          dates.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
        }
      }

      for (const date of dates) {
        const amount = spec.amountJitter === 0 ? spec.base : jitter(spec.base, spec.amountJitter);
        await upsertTxn({
          accountId: accountId[spec.account],
          amount: -amount, // expenses are negative
          description: spec.merchant,
          merchant: spec.merchant,
          date,
          type: TransactionType.EXPENSE,
        });
      }
    }

    // Travel spike roughly every 4th month
    if (monthsAgo % 4 === 2) {
      for (const t of TRAVEL_MERCHANTS) {
        const day = Math.min(10 + Math.floor(rand() * 10), lastDay);
        await upsertTxn({
          accountId: accountId.rewards,
          amount: -jitter(t.base, 0.25),
          description: t.merchant,
          merchant: t.merchant,
          date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day),
          type: TransactionType.EXPENSE,
        });
      }
    }

    // Monthly card payments from checking (positive on the card = payment)
    if (lastDay >= 25) {
      await upsertTxn({
        accountId: accountId.rewards,
        amount: jitter(1400, 0.2),
        description: 'Payment Thank You - Web',
        merchant: null,
        date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 25),
        type: TransactionType.TRANSFER,
      });
      await upsertTxn({
        accountId: accountId.cashback,
        amount: jitter(700, 0.2),
        description: 'CAPITAL ONE AUTOPAY PYMT',
        merchant: null,
        date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 25),
        type: TransactionType.TRANSFER,
      });
    }

    // Salary into checking twice a month
    for (const day of [1, 15]) {
      if (day <= lastDay) {
        await upsertTxn({
          accountId: checking.id,
          amount: 3250,
          description: 'ACME CORP PAYROLL DIRECT DEPOSIT',
          merchant: 'ACME CORP',
          date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day),
          type: TransactionType.INCOME,
        });
      }
    }
  }

  // 5. Current-month budgets
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const budgets = [
    { name: 'Dining Out', category: 'Food & Dining', amount: 450 },
    { name: 'Groceries', category: 'Food & Dining', amount: 500 },
    { name: 'Entertainment', category: 'Personal & Family', amount: 150 },
    { name: 'Transportation', category: 'Transportation', amount: 250 },
  ];

  for (const b of budgets) {
    const existing = await prisma.budget.findFirst({
      where: { userId: user.id, name: b.name },
    });
    // Spent is computed for display from transactions; keep the stored column in sync loosely
    const spentAgg = await prisma.transaction.aggregate({
      where: {
        userId: user.id,
        category: b.category,
        type: 'EXPENSE',
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });
    const spent = Math.abs(Number(spentAgg._sum.amount ?? 0));

    if (existing) {
      await prisma.budget.update({
        where: { id: existing.id },
        data: { amount: b.amount, spent, startDate: monthStart, endDate: monthEnd, isActive: true },
      });
    } else {
      await prisma.budget.create({
        data: {
          userId: user.id,
          name: b.name,
          category: b.category,
          amount: b.amount,
          spent,
          period: BudgetPeriod.MONTHLY,
          startDate: monthStart,
          endDate: monthEnd,
        },
      });
    }
  }

  // 6. Starter insights (replaced by real ones when AI insights are enabled)
  const insightCount = await prisma.aIInsight.count({ where: { userId: user.id } });
  if (insightCount === 0) {
    await prisma.aIInsight.createMany({
      data: [
        {
          userId: user.id,
          type: 'TREND',
          title: 'Subscriptions add up to ~$73/month',
          description:
            'Netflix, Spotify, Hulu, Apple, and Planet Fitness total about $73 every month. Review the Recurring page to see if you still use them all.',
          impact: 'MEDIUM',
          category: 'Personal & Family',
          actionable: true,
        },
        {
          userId: user.id,
          type: 'WARNING',
          title: 'Dining budget is running hot',
          description:
            'You typically spend most of your dining budget by the third week of the month. Consider shifting $50 from entertainment.',
          impact: 'MEDIUM',
          category: 'Food & Dining',
          actionable: true,
        },
        {
          userId: user.id,
          type: 'OPPORTUNITY',
          title: 'Put travel on the rewards card',
          description:
            'Your travel purchases earn 2x points on the Sapphire Rewards card. Recent flights and hotels were split across both cards.',
          impact: 'LOW',
          category: 'Travel',
          actionable: false,
        },
      ],
    });
  }

  console.log(`Seed complete: ${created} transactions upserted for ${DEMO_EMAIL}`);

  // 7. Glidepath card domain — the Hi-Fi dataset (SEED_VERSION 3, EDR-018).
  //    Idempotent: the household's cards are wiped and recreated each run.
  const household = await prisma.household.upsert({
    where: { id: 'seed-household-glidepath' },
    update: {},
    create: { id: 'seed-household-glidepath', name: SEED_HOUSEHOLD.name },
  });
  const membersByName = new Map<string, string>();
  for (const m of SEED_HOUSEHOLD.members) {
    const member = await prisma.householdMember.upsert({
      where: { householdId_displayName: { householdId: household.id, displayName: m.displayName } },
      update: { userId: m.isDemoUser ? user.id : null, role: m.role },
      create: {
        householdId: household.id,
        displayName: m.displayName,
        role: m.role,
        userId: m.isDemoUser ? user.id : null,
      },
    });
    membersByName.set(m.displayName, member.id);
  }
  // Notifications hold the CURRENT attention occurrences derived from these
  // cards (issue #25) — reset them with the cards (the seed is the fixture).
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  // Payment-domain rows are Restrict-linked (history is never cascade-deleted),
  // so the reset removes them explicitly, references first:
  // intents → payments → statements → autopay links → accounts → cards.
  await prisma.paymentIntent.deleteMany({ where: { householdId: household.id } });
  await prisma.scheduledPayment.deleteMany({ where: { card: { householdId: household.id } } });
  await prisma.statement.deleteMany({ where: { card: { householdId: household.id } } });
  await prisma.providerAutopayLink.deleteMany({ where: { card: { householdId: household.id } } });
  await prisma.financialAccount.deleteMany({ where: { householdId: household.id } });
  await prisma.creditCard.deleteMany({ where: { householdId: household.id } });
  const cardIdsByName = new Map<string, string>();
  for (const c of SEED_CARDS) {
    const card = await prisma.creditCard.create({
      data: {
        householdId: household.id,
        ownerMemberId: c.owner ? membersByName.get(c.owner) : null,
        attribution: c.owner ? 'MEMBER' : 'SHARED',
        cardName: c.cardName,
        lastFour: c.lastFour,
        issuer: c.issuer,
        issuerKey: c.issuerKey,
        cardType: c.cardType,
        creditLimitMinor: c.creditLimitMinor,
        currentBalanceMinor: c.currentBalanceMinor,
        regularAprBps: c.regularAprBps,
        paymentDueDay: c.paymentDueDay,
        statementCloseDay: c.statementCloseDay ?? null,
        minimumPaymentMinor: c.minimumPaymentMinor,
        limitSource: c.creditLimitMinor != null ? 'MANUAL' : 'UNKNOWN',
        aprSource: c.regularAprBps != null || c.promo != null ? 'MANUAL' : 'UNKNOWN',
        minimumSource: c.minimumPaymentMinor != null ? 'MANUAL' : 'UNKNOWN',
        notes: c.notes,
        promoPeriods: c.promo
          ? {
              create: {
                promoAprBps: 0,
                regularAprBpsAfter: c.promo.regularAprBpsAfter,
                endsOn: new Date(`${c.promo.endsOn}T00:00:00Z`),
                shelteredBalanceMinor: c.currentBalanceMinor,
                status: 'ACTIVE',
              },
            }
          : undefined,
      },
    });
    cardIdsByName.set(c.cardName, card.id);
  }
  console.log(
    `Glidepath cards seeded: ${SEED_CARDS.length} cards in "${SEED_HOUSEHOLD.name}" (seed version ${SEED_VERSION})`
  );

  // 7b. Payment-domain fixture (issue #42) — record-only rows per EDR-010.
  //     Cards resolved by name (unique in the fixture; lastFour is never a key).
  const day = (s: string) => new Date(`${s}T00:00:00Z`);
  const accountIdsByName = new Map<string, string>();
  for (const a of SEED_FINANCIAL_ACCOUNTS) {
    const account = await prisma.financialAccount.create({
      data: {
        householdId: household.id,
        name: a.name,
        institution: a.institution,
        accountType: a.accountType,
        lastFour: a.lastFour,
      },
    });
    accountIdsByName.set(a.name, account.id);
  }
  for (const p of SEED_SCHEDULED_PAYMENTS) {
    await prisma.scheduledPayment.create({
      data: {
        cardId: cardIdsByName.get(p.cardName)!,
        fundingAccountId: p.fundingAccountName ? accountIdsByName.get(p.fundingAccountName) : null,
        amountMinor: p.amountMinor,
        scheduledFor: day(p.scheduledFor),
        status: p.status,
        resolvedAt: p.resolvedAt ? day(p.resolvedAt) : null,
        note: p.note,
      },
    });
  }
  for (const s of SEED_STATEMENTS) {
    await prisma.statement.create({
      data: {
        cardId: cardIdsByName.get(s.cardName)!,
        periodStart: s.periodStart ? day(s.periodStart) : null,
        closingDate: day(s.closingDate),
        dueDate: s.dueDate ? day(s.dueDate) : null,
        statementBalanceMinor: s.statementBalanceMinor,
        minimumDueMinor: s.minimumDueMinor,
        source: 'MANUAL',
      },
    });
  }
  for (const l of SEED_AUTOPAY_LINKS) {
    await prisma.providerAutopayLink.create({
      data: {
        cardId: cardIdsByName.get(l.cardName)!,
        providerUrl: l.providerUrl,
        autopayActive: l.autopayActive,
        note: l.note,
      },
    });
  }
  console.log(
    `Payment domain seeded: ${SEED_FINANCIAL_ACCOUNTS.length} account, ${SEED_SCHEDULED_PAYMENTS.length} scheduled payments, ${SEED_STATEMENTS.length} statements, ${SEED_AUTOPAY_LINKS.length} autopay links`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
