/**
 * Header / App Navigation Links
 *
 * Shared navigation links for the navbar, mobile nav, and user menu.
 */

export interface NavLink {
  href: string;
  label: string;
}

export const headerNavLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
  { href: "/analytics", label: "Insights" },
  { href: "/budgets", label: "Budgets" },
  { href: "/recurring", label: "Recurring" },
  { href: "/settings", label: "Settings" },
];
