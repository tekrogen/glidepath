import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────────

export interface AccountData {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  accountNumber: string | null;
  isActive: boolean;
  updatedAt: Date;
}

export interface AccountGroup {
  name: string;
  totalBalance: number;
  accounts: AccountData[];
}

export interface NetWorthChartPoint {
  date: string; // YYYY-MM-DD
  netWorth: number;
  assets: number;
  liabilities: number;
  cash?: number;
  creditCards?: number;
}

export interface AccountsSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  accountGroups: AccountGroup[];
  assets: { name: string; amount: number }[];
  liabilities: { name: string; amount: number }[];
  chartData: NetWorthChartPoint[];
}

// ─── Group Name Mapping ─────────────────────────────────────────────

const TYPE_TO_GROUP: Record<string, string> = {
  CHECKING: 'Cash',
  SAVINGS: 'Cash',
  CREDIT: 'Credit Cards',
  LOAN: 'Loans',
};

const ASSET_TYPES = new Set(['CHECKING', 'SAVINGS']);
const LIABILITY_TYPES = new Set(['CREDIT', 'LOAN']);

// ─── Service ────────────────────────────────────────────────────────

export async function getAccountsData(userId: string): Promise<AccountsSummary> {
  const accounts = await prisma.userAccount.findMany({
    where: { userId, isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  // Convert Decimal → number and build AccountData[]
  const accountData: AccountData[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    institution: a.institution,
    balance: Number(a.balance),
    accountNumber: a.accountNumber,
    isActive: a.isActive,
    updatedAt: a.updatedAt,
  }));

  // Group by display group
  const groupMap = new Map<string, AccountData[]>();
  for (const acct of accountData) {
    const groupName = TYPE_TO_GROUP[acct.type] || 'Other';
    const list = groupMap.get(groupName) || [];
    list.push(acct);
    groupMap.set(groupName, list);
  }

  // Build ordered groups: Cash, Credit Cards, Loans
  const groupOrder = ['Cash', 'Credit Cards', 'Loans', 'Other'];
  const accountGroups: AccountGroup[] = [];
  for (const name of groupOrder) {
    const groupAccounts = groupMap.get(name);
    if (!groupAccounts || groupAccounts.length === 0) continue;
    const totalBalance = groupAccounts.reduce((sum, a) => sum + a.balance, 0);
    accountGroups.push({ name, totalBalance, accounts: groupAccounts });
  }

  // Calculate asset/liability totals
  let totalAssets = 0;
  let totalLiabilities = 0;
  const assetBreakdown = new Map<string, number>();
  const liabilityBreakdown = new Map<string, number>();

  for (const acct of accountData) {
    if (ASSET_TYPES.has(acct.type)) {
      totalAssets += acct.balance;
      const groupName = TYPE_TO_GROUP[acct.type] || 'Other';
      assetBreakdown.set(groupName, (assetBreakdown.get(groupName) || 0) + acct.balance);
    } else if (LIABILITY_TYPES.has(acct.type)) {
      totalLiabilities += Math.abs(acct.balance);
      const groupName = TYPE_TO_GROUP[acct.type] || 'Other';
      liabilityBreakdown.set(groupName, (liabilityBreakdown.get(groupName) || 0) + Math.abs(acct.balance));
    }
  }

  const netWorth = totalAssets - totalLiabilities;

  const cashTotal = assetBreakdown.get('Cash') || 0;
  const creditCardTotal = liabilityBreakdown.get('Credit Cards') || 0;
  const loanTotal = liabilityBreakdown.get('Loans') || 0;

  // Reconstruct net-worth history from transactions. Each Transaction.amount is the
  // signed change to its account (positive = money in, negative = out), so a cash
  // transaction moves net worth by +amount and a credit transaction moves *owed* by
  // -amount. We walk balances backward from today's real totals. Loan balances are
  // held at their current value.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const dayKey = (d: Date) => d.toISOString().split('T')[0];

  const cashAccountIds = accountData
    .filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS')
    .map((a) => a.id);
  const creditAccountIds = accountData
    .filter((a) => a.type === 'CREDIT')
    .map((a) => a.id);
  const cashIdSet = new Set(cashAccountIds);
  const reconstructIds = [...cashAccountIds, ...creditAccountIds];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const chartData: NetWorthChartPoint[] = [];

  if (reconstructIds.length > 0) {
    const earliest = await prisma.transaction.findFirst({
      where: { userId, accountId: { in: reconstructIds } },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    if (earliest) {
      // Window: last year, but never before the first real transaction.
      const oneYear = new Date(today);
      oneYear.setUTCFullYear(oneYear.getUTCFullYear() - 1);
      const earliestDay = new Date(earliest.date);
      earliestDay.setUTCHours(0, 0, 0, 0);
      const from = earliestDay.getTime() > oneYear.getTime() ? earliestDay : oneYear;

      const txns = await prisma.transaction.findMany({
        where: { userId, date: { gte: from }, accountId: { in: reconstructIds } },
        select: { date: true, amount: true, accountId: true },
      });

      const cashDelta = new Map<string, number>();
      const creditDelta = new Map<string, number>();
      for (const t of txns) {
        const key = dayKey(t.date);
        const amt = Number(t.amount);
        const target = cashIdSet.has(t.accountId) ? cashDelta : creditDelta;
        target.set(key, (target.get(key) || 0) + amt);
      }

      // Walk backward from current balances, recording end-of-day net worth.
      let cash = cashTotal;
      let creditOwed = creditCardTotal;
      const DAY_MS = 24 * 60 * 60 * 1000;
      const points: NetWorthChartPoint[] = [];
      for (let ms = today.getTime(); ms >= from.getTime(); ms -= DAY_MS) {
        const key = dayKey(new Date(ms));
        const assets = cash;
        const liabilities = creditOwed + loanTotal;
        points.push({
          date: key,
          netWorth: round2(assets - liabilities),
          assets: round2(assets),
          liabilities: round2(liabilities),
          cash: round2(cash),
          creditCards: round2(creditOwed),
        });
        // Reverse this day's transactions to reach the previous day's balances.
        cash -= cashDelta.get(key) || 0;
        creditOwed += creditDelta.get(key) || 0;
      }
      points.reverse();
      chartData.push(...points);
    }
  }

  // Fallback: no transactions yet — a single point for today with current balances.
  if (chartData.length === 0) {
    chartData.push({
      date: dayKey(today),
      netWorth: round2(netWorth),
      assets: round2(totalAssets),
      liabilities: round2(totalLiabilities),
      cash: round2(cashTotal),
      creditCards: round2(creditCardTotal),
    });
  }

  return {
    netWorth,
    totalAssets,
    totalLiabilities,
    accountGroups,
    assets: Array.from(assetBreakdown.entries()).map(([name, amount]) => ({ name, amount })),
    liabilities: Array.from(liabilityBreakdown.entries()).map(([name, amount]) => ({ name, amount })),
    chartData,
  };
}
