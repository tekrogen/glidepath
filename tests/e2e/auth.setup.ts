import { test as setup, expect } from '@playwright/test';

import { authFile, emptyAuthFile } from '../../playwright.config';
import { DEMO_USER, EMPTY_DEMO_USER } from '../../src/lib/auth/providers';

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

/**
 * Signs in as the card-less fixture user (issue #29) and saves its
 * storageState so the empty-state project reuses that empty session.
 */
setup('authenticate as empty (card-less) user', async ({ page }) => {
  await page.goto('/signin');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('Try the demo account')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Email').fill(EMPTY_DEMO_USER.email);
  await page.getByLabel('Password').fill(EMPTY_DEMO_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL(/\/overview/, { timeout: 30000 });

  await page.context().storageState({ path: emptyAuthFile });
});
