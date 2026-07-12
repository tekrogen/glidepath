import { test as setup, expect } from '@playwright/test';

import { authFile } from '../../playwright.config';
import { DEMO_USER } from '../../src/lib/auth/providers';

/**
 * Auth Setup
 *
 * Signs in as the seeded demo user via the credentials provider,
 * then saves storageState so authenticated tests reuse the session.
 */
setup('authenticate as demo user', async ({ page }) => {
  await page.goto('/signin');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Try the demo account')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Email').fill(DEMO_USER.email);
  await page.getByLabel('Password').fill(DEMO_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL(/\/overview/, { timeout: 30000 });

  await page.context().storageState({ path: authFile });
});
