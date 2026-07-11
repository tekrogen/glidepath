import { test, expect } from '@playwright/test';

/**
 * Settings Page (Authenticated)
 */

test.describe('Settings page', () => {
  test('/settings renders settings heading', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Settings');
  });
});
