import { test, expect } from '@playwright/test';

/**
 * API Routes
 *
 * Verifies auth enforcement and authenticated access.
 */

test.describe('API auth enforcement', () => {
  test('GET /api/plaid/items returns 401 without auth', async ({ request }) => {
    const response = await request.fetch('/api/plaid/items', {
      headers: { Cookie: '' },
    });

    expect(response.status()).toBe(401);
  });

  test('GET /api/transactions/export returns 401 without auth', async ({ request }) => {
    const response = await request.fetch('/api/transactions/export', {
      headers: { Cookie: '' },
    });

    expect(response.status()).toBe(401);
  });

  test('GET /api/auth/providers includes demo-credentials', async ({ request }) => {
    const response = await request.get('/api/auth/providers');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('demo-credentials');
  });
});

test.describe('Authenticated API access', () => {
  test('GET /api/plaid/items returns items array', async ({ request }) => {
    const response = await request.get('/api/plaid/items');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });
});
