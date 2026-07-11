import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────

export interface TransactionData {
  id: string;
  description: string;
  merchant: string | null;
  category: string;
  subcategory: string | null;
  amount: number;
  type: string;
  status: string;
  date: Date;
  accountName: string;
  accountId: string;
}

export interface TransactionsByDate {
  date: string;
  total: number;
  transactions: TransactionData[];
}

export interface TransactionsSummary {
  totalTransactions: number;
  totalIncome: number;
  totalSpending: number;
  largestTransaction: number;
  largestExpense: number;
  averageTransaction: number;
  firstTransactionDate: Date | null;
  lastTransactionDate: Date | null;
}

export interface TransactionsResult {
  transactionsByDate: TransactionsByDate[];
  summary: TransactionsSummary;
  totalCount: number;
}

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  category?: string;
  accountId?: string;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  limit?: number;
  offset?: number;
}

// ─── Service ────────────────────────────────────────────────────────

export async function getTransactionsData(
  userId: string,
  filters?: TransactionFilters
): Promise<TransactionsResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dateFrom = filters?.dateFrom || thirtyDaysAgo;
  const dateTo = filters?.dateTo || now;
  const limit = filters?.limit || 200;
  const offset = filters?.offset || 0;

  // Build where clause
  const where: Prisma.TransactionWhereInput = {
    userId,
    date: { gte: dateFrom, lte: dateTo },
  };

  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.accountId) {
    where.accountId = filters.accountId;
  }
  if (filters?.type) {
    where.type = filters.type;
  }

  // Summary where — same date window (and category, when filtered) across all matching
  const summaryWhere: Prisma.TransactionWhereInput = {
    userId,
    date: { gte: dateFrom, lte: dateTo },
    ...(filters?.category ? { category: filters.category } : {}),
  };
  const categorySql = filters?.category
    ? Prisma.sql`AND category = ${filters.category}`
    : Prisma.empty;

  // Fetch transactions with account relation
  const [transactions, totalCount, summaryAgg] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where }),
    // Summary stats across all matching (not just paginated)
    prisma.transaction.aggregate({
      where: summaryWhere,
      _sum: { amount: true },
      _count: true,
      _min: { date: true },
      _max: { date: true },
    }),
  ]);

  // Convert to TransactionData[]
  const txnData: TransactionData[] = transactions.map((t) => ({
    id: t.id,
    description: t.description,
    merchant: t.merchant,
    category: t.category,
    subcategory: t.subcategory,
    amount: Number(t.amount),
    type: t.type,
    status: t.status,
    date: t.date,
    accountName: t.account.name,
    accountId: t.accountId,
  }));

  // Group by date (descending)
  const dateGroupMap = new Map<string, TransactionData[]>();
  for (const txn of txnData) {
    const dateKey = txn.date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const list = dateGroupMap.get(dateKey) || [];
    list.push(txn);
    dateGroupMap.set(dateKey, list);
  }

  const transactionsByDate: TransactionsByDate[] = Array.from(dateGroupMap.entries()).map(
    ([date, txns]) => ({
      date,
      total: txns.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      transactions: txns,
    })
  );

  // Calculate summary stats from full dataset (separate queries for income/expense)
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...summaryWhere, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...summaryWhere, type: 'EXPENSE' },
      _sum: { amount: true },
    }),
  ]);

  // Find largest transaction and expense
  const [largestTxn, largestExp] = await Promise.all([
    prisma.$queryRaw<{ max_abs: number }[]>`
      SELECT COALESCE(MAX(ABS(amount)), 0) as max_abs
      FROM "Transaction"
      WHERE "userId" = ${userId} AND date >= ${dateFrom} AND date <= ${dateTo} ${categorySql}
    `,
    prisma.$queryRaw<{ max_abs: number }[]>`
      SELECT COALESCE(MAX(ABS(amount)), 0) as max_abs
      FROM "Transaction"
      WHERE "userId" = ${userId} AND date >= ${dateFrom} AND date <= ${dateTo} AND type = 'EXPENSE' ${categorySql}
    `,
  ]);

  const totalIncome = Number(incomeAgg._sum.amount || 0);
  const totalSpending = Math.abs(Number(expenseAgg._sum.amount || 0));
  const count = summaryAgg._count || 0;
  const totalAbsSum = totalIncome + totalSpending;

  const summary: TransactionsSummary = {
    totalTransactions: count,
    totalIncome,
    totalSpending,
    largestTransaction: Number(largestTxn[0]?.max_abs || 0),
    largestExpense: Number(largestExp[0]?.max_abs || 0),
    averageTransaction: count > 0 ? totalAbsSum / count : 0,
    firstTransactionDate: summaryAgg._min.date,
    lastTransactionDate: summaryAgg._max.date,
  };

  return { transactionsByDate, summary, totalCount };
}
