export interface CreditCardSummary {
  id: string;
  name: string;
  institution: string;
  accountNumber: string | null;
  balance: number; // amount owed (positive)
}

export interface CreditCardsWidgetData {
  totalBalance: number;
  cards: CreditCardSummary[];
  hasConnectedAccounts: boolean;
}

export interface BudgetItem {
  id: string;
  name: string;
  category: string;
  spent: number;
  limit: number;
  percentage: number;
}

export interface BudgetWidgetData {
  month: string;
  budgets: BudgetItem[];
}

export interface SpendingWidgetData {
  currentAmount: number;
  previousAmount: number;
  period: string;
}

export interface RecentTransaction {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  type: string;
}

export interface RecurringWidgetItem {
  merchant: string;
  cadence: string;
  averageAmount: number;
  nextExpectedDate: string;
}

export interface RecurringWidgetData {
  monthlyTotal: number;
  count: number;
  items: RecurringWidgetItem[];
}

export interface InsightItem {
  id: string;
  type: string;
  title: string;
  description: string;
  impact: string;
  category: string;
}

export interface DashboardPageData {
  creditCards: CreditCardsWidgetData;
  budgets: BudgetWidgetData;
  spending: SpendingWidgetData;
  recentTransactions: RecentTransaction[];
  recurring: RecurringWidgetData;
  insights: InsightItem[];
}
