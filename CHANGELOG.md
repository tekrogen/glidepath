# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-06

### Added

- Plaid integration: Link popup flow with OAuth-bank redirect support,
  cursor-based transaction sync with per-item locking, AES-256-GCM encrypted
  access tokens, JWT-verified webhooks (fail-closed), update mode for
  re-authentication, disconnect/delete flows, and a cleanup cron.
- Credit card dashboard with balance, spending, budget, transactions,
  recurring, and insights widgets.
- Accounts, transactions (with category filter + date ranges), and
  analytics/insights pages.
- Keyword-based transaction auto-categorization with 15+ categories,
  including Travel and streaming-subscription coverage.
- Recurring charge detection (weekly/biweekly/monthly/annual) computed from
  transaction history.
- Budgets page with create/edit/delete and live spent-vs-limit tracking.
- Claude-powered AI insights behind a feature flag, with mock fallback.
- Transaction CSV export honoring range and category filters.
- NextAuth authentication: conditional Google/GitHub OAuth, demo credentials
  provider, USER/ADMIN permission-based RBAC with route guards.
- Light/dark mode plus three color themes (Blue, Orange, Midnight).
- Deterministic demo seed: 9 months of credit-card data, budgets, and
  insights (idempotent re-seeds).
- Docker Compose for local PostgreSQL; annotated `.env.example`; README and
  SETUP guides.
