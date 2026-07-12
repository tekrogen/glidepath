import { test, expect } from '@playwright/test';

/**
 * Auth Redirects
 *
 * Verifies protected routes redirect unauthenticated users to /signin.
 */

const protectedRoutes = [
  '/overview',
  '/settings',
  '/analytics',
  '/budgets',
  '/transactions',
  '/accounts',
];

for (const route of protectedRoutes) {
  test(`${route} redirects to /signin`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/signin/);
  });
}
