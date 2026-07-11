import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────────

export interface AccountDetail {
  id: string;
  name: string;
  type: string;
  institution: string;
  balance: number;
  accountNumber: string | null;
  updatedAt: string;
  // Recent transactions (for banking accounts)
  recentTransactions: TransactionDetail[];
  transactionSummary: {
    totalIncome: number;
    totalExpenses: number;
    transactionCount: number;
  };
}

export interface TransactionDetail {
  id: string;
  description: string;
  merchant: string | null;
  category: string;
  amount: number;
  type: string;
  date: string;
}

// ─── Service ────────────────────────────────────────────────────────

export async function getAccountDetail(
  userId: string,
  accountId: string
): Promise<AccountDetail | null> {
  const account = await prisma.userAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Parallel fetch: recent transactions + 30-day aggregates
  const [recentTxns, incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId, userId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'desc' },
      take: 50,
      select: {
        id: true,
        description: true,
        merchant: true,
        category: true,
        amount: true,
        type: true,
        date: true,
      },
    }),
    prisma.transaction.aggregate({
      where: { accountId, userId, date: { gte: thirtyDaysAgo }, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId, userId, date: { gte: thirtyDaysAgo }, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ]);

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    institution: account.institution,
    balance: Number(account.balance),
    accountNumber: account.accountNumber,
    updatedAt: account.updatedAt.toISOString(),
    recentTransactions: recentTxns.map((t) => ({
      id: t.id,
      description: t.description,
      merchant: t.merchant,
      category: t.category,
      amount: Number(t.amount),
      type: t.type,
      date: t.date.toISOString(),
    })),
    transactionSummary: {
      totalIncome: Number(incomeAgg._sum.amount || 0),
      totalExpenses: Math.abs(Number(expenseAgg._sum.amount || 0)),
      transactionCount: recentTxns.length,
    },
  };
}
