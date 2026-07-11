import { test, expect } from '@playwright/test';

/**
 * Dashboard (Authenticated)
 *
 * Uses storageState from auth.setup.ts (signed in as demo user).
 */

test.describe('Dashboard page', () => {
  test('renders without 500 error', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).not.toBe(500);
  });

  test('displays Dashboard heading', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('loads dashboard widgets', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const content = await page.textContent('body');
    expect(content).not.toContain('Unable to load dashboard');
  });
});
