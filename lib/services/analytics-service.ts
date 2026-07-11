import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────────

export interface MonthlyFlow {
  month: string;
  fullDate: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface AnalyticsMetrics {
  monthlyIncome: number;
  monthlySpending: number;
  spendingTrend: number;
  spendingTrendAmount: number;
  savingsRate: number;
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics;
  monthlyFlow: MonthlyFlow[];
  categoryBreakdown: CategoryBreakdown[];
  yearToDate: {
    income: number;
    expenses: number;
    netSavings: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Service ────────────────────────────────────────────────────────

export async function getAnalyticsData(userId: string): Promise<AnalyticsData> {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // All transactions in 12 months
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: twelveMonthsAgo } },
    select: { date: true, amount: true, type: true, category: true },
    orderBy: { date: 'asc' },
  });

  // ── Monthly Cash Flow ──
  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    monthlyMap.set(date.toISOString().substring(0, 7), { income: 0, expenses: 0 });
  }

  for (const tx of transactions) {
    const monthKey = tx.date.toISOString().substring(0, 7);
    const data = monthlyMap.get(monthKey);
    if (data) {
      if (tx.type === 'INCOME') {
        data.income += Number(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        data.expenses += Math.abs(Number(tx.amount));
      }
    }
  }

  const monthlyFlow: MonthlyFlow[] = Array.from(monthlyMap.entries())
    .map(([key, data]) => {
      const monthIndex = parseInt(key.split('-')[1]) - 1;
      return {
        month: MONTH_NAMES[monthIndex],
        fullDate: key,
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100,
        net: Math.round((data.income - data.expenses) * 100) / 100,
      };
    })
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  // ── Category Breakdown (current month) ──
  const currentMonthExpenses = transactions.filter(
    (tx) => tx.type === 'EXPENSE' && tx.date >= thisMonthStart
  );
  const categoryMap = new Map<string, { amount: number; count: number }>();
  for (const tx of currentMonthExpenses) {
    const cat = tx.category || 'Uncategorized';
    const existing = categoryMap.get(cat) || { amount: 0, count: 0 };
    existing.amount += Math.abs(Number(tx.amount));
    existing.count += 1;
    categoryMap.set(cat, existing);
  }
  const totalCategorySpending = Array.from(categoryMap.values()).reduce((s, v) => s + v.amount, 0);
  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      percentage: totalCategorySpending > 0 ? Math.round((data.amount / totalCategorySpending) * 1000) / 10 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ── Metrics ──
  // This month's income
  const monthlyIncome = transactions
    .filter((tx) => tx.type === 'INCOME' && tx.date >= thisMonthStart)
    .reduce((s, tx) => s + Number(tx.amount), 0);

  // Spending trend: this month vs last month
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthExpenses = transactions
    .filter((tx) => tx.type === 'EXPENSE' && tx.date >= lastMonthStart && tx.date <= lastMonthEnd)
    .reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0);
  const thisMonthExpenses = totalCategorySpending;
  const spendingTrendAmount = thisMonthExpenses - lastMonthExpenses;
  const spendingTrend = lastMonthExpenses > 0
    ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0;

  // YTD savings rate
  const ytdTransactions = transactions.filter((tx) => tx.date >= yearStart);
  const ytdIncome = ytdTransactions
    .filter((tx) => tx.type === 'INCOME')
    .reduce((s, tx) => s + Number(tx.amount), 0);
  const ytdExpenses = Math.abs(
    ytdTransactions
      .filter((tx) => tx.type === 'EXPENSE')
      .reduce((s, tx) => s + Number(tx.amount), 0)
  );
  const ytdNetSavings = ytdIncome - ytdExpenses;
  const savingsRate = ytdIncome > 0 ? (ytdNetSavings / ytdIncome) * 100 : 0;

  return {
    metrics: {
      monthlyIncome: Math.round(monthlyIncome * 100) / 100,
      monthlySpending: Math.round(thisMonthExpenses * 100) / 100,
      spendingTrend: Math.round(spendingTrend * 10) / 10,
      spendingTrendAmount: Math.round(spendingTrendAmount * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
    },
    monthlyFlow,
    categoryBreakdown,
    yearToDate: {
      income: Math.round(ytdIncome * 100) / 100,
      expenses: Math.round(ytdExpenses * 100) / 100,
      netSavings: Math.round(ytdNetSavings * 100) / 100,
    },
  };
}
