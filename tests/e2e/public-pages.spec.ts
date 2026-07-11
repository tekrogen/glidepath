import { test, expect } from '@playwright/test';

/**
 * Public Pages
 *
 * Verifies public routes render without authentication.
 */

test.describe('Landing page', () => {
  test('renders with hero section and sign-in link', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Credit Card Manager/i);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('returns 200 status', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
  });
});

test.describe('Sign-in page', () => {
  test('renders welcome heading', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('shows demo account form when demo auth is enabled', async ({ page }) => {
    await page.goto('/signin');

    await expect(page.getByText('Try the demo account')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('404 page', () => {
  test('returns 404 for non-existent route', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
