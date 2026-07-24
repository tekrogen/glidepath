# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0](https://github.com/tekrogen/glidepath/compare/v1.2.0...v1.3.0) (2026-07-24)


### Features

* /payments/new stepper on DB-backed intents with idempotent record-only confirm ([#64](https://github.com/tekrogen/glidepath/issues/64)) ([0b7885a](https://github.com/tekrogen/glidepath/commit/0b7885a6429b28b51335c3138452b0fd70e83390)), closes [#45](https://github.com/tekrogen/glidepath/issues/45)
* Payment Runway calendar page — lanes, toggle, cash chart, payoff plan, reschedule ([#62](https://github.com/tekrogen/glidepath/issues/62)) ([5a7ae8a](https://github.com/tekrogen/glidepath/commit/5a7ae8a21e82cf3e4017c29a8cc7fbda30318baa)), closes [#44](https://github.com/tekrogen/glidepath/issues/44)
* Phase 3 payment-domain schema and seed fixture (SEED_VERSION 3) ([ab5c921](https://github.com/tekrogen/glidepath/commit/ab5c9219533360e77b441c05f4ecd759132ee7ea))
* runway and debt-strategy engines in lib/finance (runwayAggregate, debtFreePlan) ([4c3bb2a](https://github.com/tekrogen/glidepath/commit/4c3bb2a0bb67ccd79fedafc3ffbb5c62a163d1ff))


### Bug Fixes

* allow the LAN-IP dev origin so pages hydrate on phones (dev:lan) ([0aff4b6](https://github.com/tekrogen/glidepath/commit/0aff4b6456d7e4da3c63cbe12ba9bc7f63e1c8af))

## [1.2.0](https://github.com/tekrogen/glidepath/compare/v1.1.0...v1.2.0) (2026-07-17)


### Features

* add card domain schema, Hi-Fi seed dataset, and portfolio service ([9e62cb7](https://github.com/tekrogen/glidepath/commit/9e62cb7e5f757b31425905cd8884e76816b5d3f9))
* add-card flow — manual-first onboarding and the first card mutation ([#33](https://github.com/tekrogen/glidepath/issues/33)) ([6e1762b](https://github.com/tekrogen/glidepath/commit/6e1762b65187105fbd5bc1e9fcd4ca9706b38df2))
* attention engine and persisted in-app notifications ([#32](https://github.com/tekrogen/glidepath/issues/32)) ([d4cbc5b](https://github.com/tekrogen/glidepath/commit/d4cbc5bc2f090ccd45235445d9ec368961c23423))
* empty and first-run states across Overview and Cards (G5) ([#37](https://github.com/tekrogen/glidepath/issues/37)) ([cf34962](https://github.com/tekrogen/glidepath/commit/cf3496299cbb5c1cfda35ab3f62fdb714b935ce3))
* freeze/unfreeze flow — popover confirm, optimistic chip, audited ([#34](https://github.com/tekrogen/glidepath/issues/34)) ([5bd2b34](https://github.com/tekrogen/glidepath/commit/5bd2b34337f25cf67bec7e3073b0f3c87d514d2a))
* Glidepath sidebar shell per mockup IA; theme-token conformance specs ([e79623b](https://github.com/tekrogen/glidepath/commit/e79623bae149d0575ff2c1f844a69a4ec77b8c51))
* Overview and Cards pages in the Ebia visual system ([711cd69](https://github.com/tekrogen/glidepath/commit/711cd691f09d4ff9906ca2772f29f9bd5be88a13))
* Overview v2 composition per the 0b wireframe ([#35](https://github.com/tekrogen/glidepath/issues/35)) ([4c8f5b6](https://github.com/tekrogen/glidepath/commit/4c8f5b6575b8bc3d6dd18d89b9238952d03f62f6))
* tracker-import onboarding UI — upload, preview, confirm (EDR-021 step 2) ([#39](https://github.com/tekrogen/glidepath/issues/39)) ([a3d0e4e](https://github.com/tekrogen/glidepath/commit/a3d0e4e68c41a5942dff326d3dbdc92ff8ee3d38))


### Bug Fixes

* hint that OAuth only works on the registered host ([#24](https://github.com/tekrogen/glidepath/issues/24)) ([30d6fbe](https://github.com/tekrogen/glidepath/commit/30d6fbeabd1a8afce9be4d37f6c2ed6c0d9b537b))
* remove orphaned /dashboard route; land post-login on /overview ([#36](https://github.com/tekrogen/glidepath/issues/36)) ([414e9a0](https://github.com/tekrogen/glidepath/commit/414e9a0ba774ad56ca7879dfc1afeae34dc90abd))
* retire creditcardmanager.app demo email and placeholder URLs ([#23](https://github.com/tekrogen/glidepath/issues/23)) ([3eff409](https://github.com/tekrogen/glidepath/commit/3eff409fe96e409783b337fb310679b58bcd6c2c))
* surface sign-in errors inline; add LAN dev mode for phone testing ([f68322c](https://github.com/tekrogen/glidepath/commit/f68322c1bfabe97a6e62c3ecec84d2040b10c045))


### Refactoring

* migrate transactions domain into features/transactions ([#38](https://github.com/tekrogen/glidepath/issues/38)) ([4af7a52](https://github.com/tekrogen/glidepath/commit/4af7a52e17b5cebb1261288904bd4e44078ca068))


### Documentation

* capture session learnings in CLAUDE.md ([#17](https://github.com/tekrogen/glidepath/issues/17)) ([1f13aab](https://github.com/tekrogen/glidepath/commit/1f13aabd909ce7fa9ec7d18b53441e36842ac6b3))

## [1.1.0](https://github.com/tekrogen/glidepath/compare/v1.0.0...v1.1.0) (2026-07-11)


### Features

* add finance calculation library and canonical status engine ([e8cd45f](https://github.com/tekrogen/glidepath/commit/e8cd45f3ace543bb5144bfdba8cff79b4d607068))
* adopt Glidepath product brand ([f9d6a09](https://github.com/tekrogen/glidepath/commit/f9d6a0904ef0a93da90ea6b680ae897ff9e2beef))


### Refactoring

* migrate app, components, and lib under src/ ([a01b274](https://github.com/tekrogen/glidepath/commit/a01b2743065e4158894a341dbe7896ba55bec596))

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
