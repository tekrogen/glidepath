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
