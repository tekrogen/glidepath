import type { Transaction as PlaidTransaction, AccountBase } from 'plaid';
import { categorizeTransaction } from '@/lib/categories';

// ─── Account Type Mapping ───────────────────────────────────────────

type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT' | 'LOAN';

/**
 * Map Plaid account type + subtype to our AccountType enum.
 */
export function mapPlaidAccountType(
  plaidType: string | null | undefined,
  plaidSubtype: string | null | undefined
): AccountType {
  const type = (plaidType || '').toLowerCase();
  const subtype = (plaidSubtype || '').toLowerCase();

  if (type === 'depository') {
    if (subtype === 'savings' || subtype === 'money market' || subtype === 'cd' || subtype === 'hsa') {
      return 'SAVINGS';
    }
    return 'CHECKING';
  }
  if (type === 'credit') return 'CREDIT';
  if (type === 'investment' || type === 'brokerage') return 'INVESTMENT';
  if (type === 'loan' || type === 'mortgage' || type === 'student') return 'LOAN';
  return 'CHECKING'; // Default fallback
}

// ─── Transaction Type Mapping ───────────────────────────────────────

type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

function determineTransactionType(
  amount: number,
  plaidCategory?: string | null
): TransactionType {
  // Plaid's personal_finance_category.primary can hint at transfers
  if (plaidCategory) {
    const cat = plaidCategory.toUpperCase();
    if (cat === 'TRANSFER_IN' || cat === 'TRANSFER_OUT') return 'TRANSFER';
  }

  // Positive in our system = income, negative = expense
  if (amount > 0) return 'INCOME';
  return 'EXPENSE';
}

// ─── Transaction Mapper ─────────────────────────────────────────────

export interface MappedTransaction {
  amount: number;
  description: string;
  originalDescription: string | null;
  merchant: string | null;
  category: string;
  subcategory: string | null;
  type: TransactionType;
  status: 'PENDING' | 'COMPLETED';
  date: Date;
  location: Record<string, unknown> | null;
  importSource: string;
  originalData: Record<string, unknown>;
}

/**
 * Map a single Plaid transaction to our Transaction schema.
 *
 * Plaid convention: positive amount = money leaving the account (expense).
 * Our convention: negative amount = expense, positive = income.
 * So we negate Plaid's amount.
 */
export function mapPlaidTransaction(txn: PlaidTransaction): MappedTransaction {
  // Negate: Plaid positive = debit (expense), we use negative for expenses
  const amount = -(txn.amount ?? 0);

  const description = txn.name || txn.merchant_name || 'Unknown Transaction';

  // Auto-categorize using our keyword engine first
  const autoCategory = categorizeTransaction(description, amount);

  // Fall back to Plaid's personal_finance_category if we got a generic result
  let category = autoCategory.category;
  let subcategory = autoCategory.subcategory || null;

  const isGenericCategory = category === 'Other Income' || category === 'Other Expenses';
  if (isGenericCategory && txn.personal_finance_category) {
    const plaidPrimary = txn.personal_finance_category.primary;
    if (plaidPrimary) {
      // Convert SCREAMING_SNAKE to Title Case
      category = plaidPrimary
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    const plaidDetailed = txn.personal_finance_category.detailed;
    if (plaidDetailed) {
      subcategory = plaidDetailed
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  const plaidPrimaryCategory = txn.personal_finance_category?.primary || null;
  const type = determineTransactionType(amount, plaidPrimaryCategory);

  // Build location object if available
  let location: Record<string, unknown> | null = null;
  if (txn.location) {
    const loc = txn.location;
    if (loc.city || loc.region || loc.lat || loc.lon) {
      location = {
        city: loc.city,
        region: loc.region,
        postalCode: loc.postal_code,
        country: loc.country,
        lat: loc.lat,
        lon: loc.lon,
        address: loc.address,
        storeNumber: loc.store_number,
      };
    }
  }

  return {
    amount,
    description,
    originalDescription: txn.original_description || null,
    merchant: txn.merchant_name || null,
    category,
    subcategory,
    type,
    status: txn.pending ? 'PENDING' : 'COMPLETED',
    date: new Date(txn.date),
    location,
    importSource: `plaid_${txn.transaction_id}`,
    originalData: txn as unknown as Record<string, unknown>,
  };
}

// ─── Account Mapper ─────────────────────────────────────────────────

export interface MappedAccount {
  name: string;
  type: AccountType;
  balance: number;
  accountNumber: string;
}

/**
 * Map a Plaid AccountBase to our UserAccount fields.
 */
export function mapPlaidAccount(
  account: AccountBase,
  institutionName: string | null
): MappedAccount {
  const balance = account.balances.current ?? account.balances.available ?? 0;
  const mask = account.mask ? `...${account.mask}` : `...${account.account_id.slice(-4)}`;
  const name = account.name || account.official_name || `${institutionName || 'Connected'} Account`;

  return {
    name,
    type: mapPlaidAccountType(account.type, account.subtype),
    balance,
    accountNumber: mask,
  };
}
