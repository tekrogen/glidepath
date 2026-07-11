import { prisma } from '@/lib/db/prisma';
import {
  getRecurringCharges,
  monthlyCost,
} from '@/lib/services/recurring-detection-service';
import type { DashboardPageData } from '../types';

export async function fetchDashboardData(userId: string): Promise<DashboardPageData> {
  const now = new Date();

  // Current month boundaries
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Previous month boundaries
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const [
    creditAccounts,
    recentTxns,
    currentMonthExpenses,
    lastMonthExpenses,
    budgets,
    insights,
    plaidItemCount,
    recurring,
  ] = await Promise.all([
    prisma.userAccount.findMany({
      where: { userId, type: 'CREDIT', isActive: true },
      orderBy: { balance: 'desc' },
      select: {
        id: true,
        name: true,
        institution: true,
        accountNumber: true,
        balance: true,
      },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5,
      include: { account: { select: { name: true } } },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        name: true,
        category: true,
        amount: true,
        spent: true,
      },
    }),
    prisma.aIInsight.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        impact: true,
        category: true,
      },
    }),
    prisma.plaidItem.count({ where: { userId } }),
    getRecurringCharges(userId),
  ]);

  // ─── Credit cards ────────────────────────────────────────────────
  const cards = creditAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: a.institution,
    accountNumber: a.accountNumber,
    balance: Number(a.balance),
  }));

  // ─── Spending ────────────────────────────────────────────────────
  const currentSpending = Math.abs(Number(currentMonthExpenses._sum.amount || 0));
  const lastMonthSpending = Math.abs(Number(lastMonthExpenses._sum.amount || 0));

  // ─── Budgets ─────────────────────────────────────────────────────
  const budgetItems = budgets.map((b) => {
    const limit = Number(b.amount);
    const spent = Number(b.spent);
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      spent,
      limit,
      percentage: limit > 0 ? (spent / limit) * 100 : 0,
    };
  });

  // ─── Recent transactions ─────────────────────────────────────────
  const recentTransactions = recentTxns.map((tx) => ({
    id: tx.id,
    merchant: tx.merchant || tx.description,
    category: tx.category,
    amount: Number(tx.amount),
    date: tx.date.toISOString().split('T')[0] ?? '',
    type: tx.type.toLowerCase(),
  }));

  // ─── Recurring ───────────────────────────────────────────────────
  const recurringData = {
    monthlyTotal: recurring.reduce((sum, c) => sum + monthlyCost(c), 0),
    count: recurring.length,
    items: recurring.slice(0, 4).map((c) => ({
      merchant: c.merchant,
      cadence: c.cadence,
      averageAmount: c.averageAmount,
      nextExpectedDate: c.nextExpectedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    })),
  };

  // ─── Insights ────────────────────────────────────────────────────
  const insightItems = insights.map((i) => ({
    id: i.id,
    type: i.type.toLowerCase(),
    title: i.title,
    description: i.description,
    impact: i.impact.toLowerCase(),
    category: i.category,
  }));

  return {
    creditCards: {
      totalBalance: cards.reduce((sum, c) => sum + c.balance, 0),
      cards,
      hasConnectedAccounts: plaidItemCount > 0 || cards.length > 0,
    },
    budgets: {
      month: monthLabel,
      budgets: budgetItems,
    },
    spending: {
      currentAmount: currentSpending,
      previousAmount: lastMonthSpending,
      period: monthLabel,
    },
    recentTransactions,
    recurring: recurringData,
    insights: insightItems,
  };
}
