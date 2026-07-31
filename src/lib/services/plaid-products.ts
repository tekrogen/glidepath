import { Products } from 'plaid';

/**
 * Product configuration for Plaid Link (pure — no I/O; issue #108).
 *
 * Keys accepted in PLAID_PRODUCTS / PLAID_OPTIONAL_PRODUCTS. Scope is governed
 * by EDR-010/EDR-026 (Transactions, Balance, Liabilities, Statements); Balance
 * needs no Link product entry — it rides along with any of the others.
 */
export const PRODUCT_MAP: Record<string, Products> = {
  transactions: Products.Transactions,
  auth: Products.Auth,
  identity: Products.Identity,
  liabilities: Products.Liabilities,
  statements: Products.Statements,
};

/** Parse a comma-separated product list; unknown keys are dropped silently. */
export function parseProducts(envVar: string | undefined, fallback: string): Products[] {
  const str = envVar ?? fallback;
  return str
    .split(',')
    .map((p) => PRODUCT_MAP[p.trim()])
    .filter(Boolean);
}

/** Trailing-12-months statements window (#158). */
export function statementsWindow(today: Date): { start_date: string; end_date: string } {
  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 1);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: today.toISOString().slice(0, 10),
  };
}

/**
 * Product-related fields for linkTokenCreate. Plaid REQUIRES a statements
 * date-range object whenever the statements product is requested — required
 * OR optional — otherwise the whole request fails INVALID_FIELD and no
 * institution can be linked at all (#158, found live in the #109 walkthrough).
 */
export function linkTokenProductOptions(
  products: Products[],
  optionalProducts: Products[],
  today: Date
): {
  products: Products[];
  optional_products?: Products[];
  statements?: { start_date: string; end_date: string };
} {
  const wantsStatements =
    products.includes(Products.Statements) || optionalProducts.includes(Products.Statements);
  return {
    products,
    ...(optionalProducts.length > 0 ? { optional_products: optionalProducts } : {}),
    ...(wantsStatements ? { statements: statementsWindow(today) } : {}),
  };
}
