import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────────

export interface MonthlyCashFlow {
  month: string;
  fullDate: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percent: number;
  count: number;
}

export interface CashFlowSummary {
  income: number;
  expenses: number;
  totalSavings: number;
  savingsRate: number;
}

export interface CashFlowData {
  currentPeriod: string;
  summary: CashFlowSummary;
  monthlyData: MonthlyCashFlow[];
  incomeBreakdown: CategoryBreakdownItem[];
  expensesBreakdown: CategoryBreakdownItem[];
  hasData: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Service ────────────────────────────────────────────────────────

export async function getCashFlowData(userId: string): Promise<CashFlowData> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const currentPeriod = `${MONTH_FULL_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  // Fetch all transactions for the 12-month window
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: twelveMonthsAgo },
    },
    select: {
      date: true,
      amount: true,
      type: true,
      category: true,
    },
    orderBy: { date: 'asc' },
  });

  if (transactions.length === 0) {
    return {
      currentPeriod,
      summary: { income: 0, expenses: 0, totalSavings: 0, savingsRate: 0 },
      monthlyData: buildEmptyMonths(now),
      incomeBreakdown: [],
      expensesBreakdown: [],
      hasData: false,
    };
  }

  // ── Monthly aggregation ──
  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    monthlyMap.set(date.toISOString().substring(0, 7), { income: 0, expenses: 0 });
  }

  for (const tx of transactions) {
    const key = tx.date.toISOString().substring(0, 7);
    const data = monthlyMap.get(key);
    if (data) {
      if (tx.type === 'INCOME') {
        data.income += Number(tx.amount);
      } else if (tx.type === 'EXPENSE') {
        data.expenses += Math.abs(Number(tx.amount));
      }
    }
  }

  const monthlyData: MonthlyCashFlow[] = Array.from(monthlyMap.entries())
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

  // ── Current month breakdown ──
  const currentMonthTxns = transactions.filter(
    (tx) => tx.date >= currentMonthStart && tx.date <= currentMonthEnd
  );

  const incomeByCat = new Map<string, { amount: number; count: number }>();
  const expenseByCat = new Map<string, { amount: number; count: number }>();

  let monthIncome = 0;
  let monthExpenses = 0;

  for (const tx of currentMonthTxns) {
    const cat = tx.category || 'Uncategorized';
    const amount = Number(tx.amount);

    if (tx.type === 'INCOME') {
      monthIncome += amount;
      const entry = incomeByCat.get(cat) || { amount: 0, count: 0 };
      entry.amount += amount;
      entry.count += 1;
      incomeByCat.set(cat, entry);
    } else if (tx.type === 'EXPENSE') {
      const absAmount = Math.abs(amount);
      monthExpenses += absAmount;
      const entry = expenseByCat.get(cat) || { amount: 0, count: 0 };
      entry.amount += absAmount;
      entry.count += 1;
      expenseByCat.set(cat, entry);
    }
  }

  const totalSavings = monthIncome - monthExpenses;
  const savingsRate = monthIncome > 0 ? (totalSavings / monthIncome) * 100 : 0;

  const incomeBreakdown = buildBreakdown(incomeByCat, monthIncome);
  const expensesBreakdown = buildBreakdown(expenseByCat, monthExpenses);

  return {
    currentPeriod,
    summary: {
      income: Math.round(monthIncome * 100) / 100,
      expenses: Math.round(monthExpenses * 100) / 100,
      totalSavings: Math.round(totalSavings * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
    },
    monthlyData,
    incomeBreakdown,
    expensesBreakdown,
    hasData: true,
  };
}

function buildBreakdown(
  catMap: Map<string, { amount: number; count: number }>,
  total: number
): CategoryBreakdownItem[] {
  return Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      percent: total > 0 ? Math.round((data.amount / total) * 1000) / 10 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildEmptyMonths(now: Date): MonthlyCashFlow[] {
  const months: MonthlyCashFlow[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthIndex = date.getMonth();
    months.push({
      month: MONTH_NAMES[monthIndex],
      fullDate: date.toISOString().substring(0, 7),
      income: 0,
      expenses: 0,
      net: 0,
    });
  }
  return months;
}
