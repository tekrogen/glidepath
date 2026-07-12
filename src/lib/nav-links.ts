/**
 * App Navigation Links
 *
 * The sidebar IA follows the newest wireframes (UIUX architecture source
 * of truth, EDR-013 / 0b Overview wireframe 2026-07-11): Overview → Cards →
 * Transactions → Payments → Rewards → Insights, "+ Add Card" pinned at the
 * bottom, remaining v1 surfaces under "Manage".
 */

export interface NavLink {
  href: string;
  label: string;
  /** Phase-gated surface that exists in the IA but is not built yet. */
  comingSoon?: boolean;
}

/** Primary product navigation — 0b Overview wireframe order (2026-07-11). */
export const primaryNavLinks: NavLink[] = [
  { href: "/overview", label: "Overview" },
  { href: "/cards", label: "Cards" },
  { href: "/transactions", label: "Transactions" },
  { href: "/payments", label: "Payments", comingSoon: true },
  { href: "/rewards", label: "Rewards", comingSoon: true },
  { href: "/analytics", label: "Insights" },
];

/** Existing v1 surfaces, kept reachable while their v2 phases land. */
export const manageNavLinks: NavLink[] = [
  { href: "/budgets", label: "Budgets" },
  { href: "/recurring", label: "Recurring" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings", label: "Settings" },
];

/** Links for the public/marketing navbar and mobile nav (non-shell surfaces). */
export const headerNavLinks: NavLink[] = [
  { href: "/overview", label: "Overview" },
  { href: "/cards", label: "Cards" },
  { href: "/transactions", label: "Transactions" },
  { href: "/analytics", label: "Insights" },
  { href: "/budgets", label: "Budgets" },
  { href: "/settings", label: "Settings" },
];
