# Glidepath

> **Glidepath** — *Every card. One ledger. Zero surprises.*
> The Tekrogen credit-card cockpit (product brand adopted 2026-07-11, Blueprint EDR-024).
> Formerly the "Credit Card Manager" starter kit; v2 plan: `admin/internal/planning/PRODUCTION-BLUEPRINT.md`.

A production-grade **Plaid-powered credit card manager** starter kit built with
Next.js 16, React 19, Prisma, NextAuth, Tailwind v4, and shadcn/ui.

Connect credit cards with Plaid, sync transactions automatically, and get a
clear picture of balances, spending, budgets, subscriptions, and AI-powered
insights — all from a codebase designed to be read, extended, and shipped.

**Author:** @tekrogen

## Features

- **Plaid integration, production-hardened** — cursor-based transaction sync
  with per-item locking, AES-256-GCM encrypted access tokens, JWT-verified
  webhooks (fail-closed), duplicate-item detection, OAuth-bank redirect flow,
  update mode for re-authentication, and a cleanup cron.
- **Credit card dashboard** — balances across cards, month-over-month spending,
  recent activity, budgets, subscriptions, and insights at a glance.
- **Auto-categorization** — keyword engine with 15+ categories and
  subcategories; every synced transaction lands categorized.
- **Recurring charge detection** — finds subscriptions and repeating payments
  from transaction history (no schema changes, pure compute-on-read).
- **Budgets** — monthly category budgets with spent-vs-limit computed live
  from transactions.
- **AI insights (optional)** — Claude-generated spending insights behind a
  feature flag; curated mock insights keep the widget populated without a key.
- **CSV export** — filtered transaction export honoring date range + category.
- **Auth & RBAC** — NextAuth with Google/GitHub OAuth (auto-enabled when
  configured), demo credentials login, and a permission-based guard system
  with orthogonal USER/ADMIN domains.
- **Theming** — light/dark mode plus three color themes (Blue, Orange,
  Midnight) with anti-FOUC handling.
- **Seeded demo mode** — 9 months of realistic, deterministic credit-card data
  so the app is fully explorable with zero external keys.

## Quick start

Requirements: Node 22+, pnpm, Docker (or any local PostgreSQL 14+).

```bash
pnpm install
cp .env.example .env         # then set NEXTAUTH_SECRET (openssl rand -base64 32)
docker compose up -d         # local Postgres
pnpm db:push                 # create schema
pnpm db:seed                 # demo user + 9 months of data
pnpm dev
```

Open http://localhost:6014 and sign in with the demo account:

> **demo@glidepath.cards** / **demo-password**

No Plaid, OAuth, or Anthropic keys required for the demo. To link real
(sandbox) accounts, see **[SETUP.md](./SETUP.md)** for the 10-minute Plaid
walkthrough.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | ✅ | NextAuth base URL + JWT secret |
| `ENABLE_DEMO_AUTH` (+ `NEXT_PUBLIC_ENABLE_DEMO_AUTH`) | — | Demo credentials login (default on; **disable before real users**) |
| `ADMIN_EMAIL` | — | Comma-separated emails promoted to ADMIN on sign-in |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | — | OAuth providers (appear automatically when set) |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | — | Plaid keys (`sandbox` or `production`) |
| `PLAID_ENCRYPTION_KEY` | with Plaid | 32-byte hex key encrypting access tokens at rest |
| `PLAID_REDIRECT_URI`, `PLAID_WEBHOOK_URL` | — | OAuth-bank redirect + webhook receiver |
| `ENABLE_AI_INSIGHTS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | — | Claude-powered insights |
| `CRON_SECRET` | — | Protects `/api/cron/plaid-cleanup` |

Full annotated list in [.env.example](./.env.example).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:6014 |
| `pnpm dev:https` | Dev server with self-signed HTTPS (https://localhost:6014) |
| `pnpm build` / `pnpm start` | Production build / serve (port 6014) |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm db:push` | Sync Prisma schema (dev) |
| `pnpm db:migrate` | Create a migration (production workflow) |
| `pnpm db:seed` | Seed/refresh demo data (idempotent) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm test:e2e` | Playwright E2E tests (starts dev server + seeds DB) |
| `pnpm test:e2e:ui` | Playwright interactive UI mode |
| `pnpm test:e2e:install` | Install Playwright Chromium (one-time) |

## Architecture

```
app/
  (auth)/            signin, signout, connect-account (Plaid Link popup flow)
  (dashboard)/       dashboard, accounts, transactions, analytics, budgets,
                     recurring, settings
  api/
    auth/            NextAuth
    plaid/           link-token, exchange, items, sync
    webhooks/plaid/  JWT-verified webhook receiver
    cron/            plaid-cleanup (CRON_SECRET-protected)
    ai/insights      Claude insights (flagged)
    transactions/export  CSV
components/
  ui/                local shadcn/ui components (new-york style)
  plaid/             PlaidLinkButton, ConnectedAccountsList
  dashboard/         layout + widgets
lib/
  auth/              NextAuth config, RBAC constants, route guards
  services/          plaid-service, mappers, webhook verifier,
                     recurring-detection, ai-insights, transaction/analytics
  categories.ts      keyword categorization engine
prisma/
  schema.prisma      User, PlaidItem, UserAccount, Transaction, Budget, ...
  seed.ts            deterministic demo data
```

**Key conventions**

- **Amount sign**: expenses are negative, income/payments positive. Credit
  card `balance` is the positive amount owed.
- **Sync idempotency**: transactions upsert on the unique `importSource`
  (`plaid_<transaction_id>`), so re-syncs never duplicate.
- **Guards**: API routes use `requireAuth()` / `requirePermission()` from
  `lib/auth/guards.ts`. USER owns financial data + Plaid connections; ADMIN is
  platform-only and intentionally has **no** access to financial data.

## Production checklist

- [ ] `ENABLE_DEMO_AUTH=false` and `NEXT_PUBLIC_ENABLE_DEMO_AUTH=false`
- [ ] Switch `pnpm db:push` to `pnpm db:migrate` migrations
- [ ] `PLAID_ENV=production` + production secret (requires Plaid approval)
- [ ] Register your production `PLAID_REDIRECT_URI` and `PLAID_WEBHOOK_URL`
- [ ] Schedule `/api/cron/plaid-cleanup` daily (e.g. `vercel.json` cron) with `CRON_SECRET`
- [ ] Rotate `NEXTAUTH_SECRET` / `PLAID_ENCRYPTION_KEY` away from any shared values

## Follow-ups (noted 2026-07-07)

Items deliberately deferred after the initial Playwright E2E wiring — revisit these:

1. **GitHub Actions CI for E2E.** Add a workflow that runs `pnpm test:e2e:install` then `pnpm test:e2e` with `CI=true` (fresh server, GitHub reporter). Needs Postgres service container + `DATABASE_URL` / `NEXTAUTH_SECRET` in repo secrets.
2. **Plaid sandbox E2E.** Smoke tests cover demo auth and public/protected routes; the connect-account Link flow (`user_good` / `pass_good`) is still untested in automation. Add a gated spec (runs only when `PLAID_CLIENT_ID` + `PLAID_SECRET` are set).
3. **`@axe-core/playwright` is installed but unused.** Wire accessibility scans into `public-pages.spec.ts` or a dedicated `a11y.spec.ts` before calling the suite production-ready.
4. **Vitest has no config or tests.** `vitest` / `@vitest/coverage-v8` are devDependencies with zero harness — either scaffold unit tests for services (`recurring-detection`, categorization) or drop the unused deps.
5. **Broader page coverage.** Current specs stop at dashboard/settings/API smoke tests. Add specs for transactions (filter + CSV button), budgets CRUD, recurring page, and accounts list when those flows stabilize.
6. **Local `reuseExistingServer` caveat.** When `pnpm dev` is already running, Playwright reuses it and does *not* apply `webServer.env` (`ENABLE_DEMO_AUTH=true`). Stop the stale server or match that env in `.env`, or auth setup fails.

## License

Commercial template license — see [LICENSE.md](./LICENSE.md). You may build
and ship unlimited end products with this code; you may not redistribute or
resell the template itself.
