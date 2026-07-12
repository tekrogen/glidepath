/**
 * App Navigation Links
 *
 * The sidebar IA follows the mockup (UIUX architecture source of truth,
 * EDR-013): Overview → Cards → Payment Runway → Swipe Matrix → Wallet,
 * with the v1 money surfaces under a secondary "Manage" group until
 * their Glidepath phases land.
 */

export interface NavLink {
  href: string;
  label: string;
  /** Phase-gated surface that exists in the IA but is not built yet. */
  comingSoon?: boolean;
}

/** Primary product navigation — mockup order. */
export const primaryNavLinks: NavLink[] = [
  { href: "/overview", label: "Overview" },
  { href: "/cards", label: "Cards" },
  { href: "/payments", label: "Payment Runway", comingSoon: true },
  { href: "/rewards", label: "Swipe Matrix", comingSoon: true },
  { href: "/wallet", label: "Wallet", comingSoon: true },
];

/** Existing v1 surfaces, kept reachable while their v2 phases land. */
export const manageNavLinks: NavLink[] = [
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/recurring", label: "Recurring" },
  { href: "/analytics", label: "Insights" },
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
