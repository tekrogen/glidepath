import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Playwright E2E Test Configuration
 *
 * Three project setup:
 * - setup: Signs in via demo credentials, saves storageState
 * - public: Tests public pages and auth redirects (no auth required)
 * - authenticated: Tests dashboard, settings, API routes (depends on setup)
 */

const authFile = path.join(__dirname, 'tests', '.auth', 'user.json');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:6014',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    {
      name: 'public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /public-pages\.spec\.ts|auth-redirects\.spec\.ts/,
    },

    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testMatch: /dashboard\.spec\.ts|settings-redirect\.spec\.ts|api-routes\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'pnpm db:generate && pnpm db:push && pnpm db:seed && pnpm dev',
    url: process.env.TEST_BASE_URL || 'http://localhost:6014',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      ENABLE_DEMO_AUTH: 'true',
      NEXT_PUBLIC_ENABLE_DEMO_AUTH: 'true',
      NEXTAUTH_URL: 'http://localhost:6014',
    },
  },
});

export { authFile };
