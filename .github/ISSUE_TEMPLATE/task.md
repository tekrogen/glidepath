---
name: Task
about: Planned build work, maintenance, or technical debt
title: ""
labels: type:task
assignees: ""
---

<!--
Before submitting, add: phase:N, and severity:* if this is gate-relevant.
Use type:debt instead of type:task when it is cleanup rather than planned build work.
-->

## Description

## Objective

What is true when this is done? Write it as observable behavior in the running app, not as "implement X".

## Category

- [ ] Build (planned phase work)
- [ ] Technical debt / refactor
- [ ] Testing (coverage, fixtures, conformance)
- [ ] Documentation (blueprint, README, runbook)
- [ ] Release / CI / deploy
- [ ] Security

## Acceptance criteria

- [ ]
- [ ]
- [ ]

## Files affected

Name the layer, so the boundary rules are visible up front.

- Routes / composition (`src/app/...`) —
- Domain (`src/features/<domain>/...`) —
- Finance math (`src/lib/finance/...`) —
- Schema (`prisma/schema.prisma`) —

## Constraints that apply

- [ ] All financial math stays in `src/lib/finance` — pure, no I/O (EDR-019)
- [ ] New card-domain money fields are integer minor units + ISO currency; APRs in basis points (EDR-008)
- [ ] `bigint` is serialized to `number` cents before crossing the RSC → client boundary
- [ ] Card status/alerts derive only from `src/features/cards/utils/card-status.ts`
- [ ] Nothing keys or matches cards on last-four
- [ ] Estimated figures render through `EstimatedValue` with `~` (EDR-020)
- [ ] Manual entry stays first-class (EDR-022)

## Things that must stay in sync

Tick any this touches — each has three homes and all three must change together.

- [ ] Color theme names → `lib/themes.ts` · anti-FOUC script in `app/layout.tsx` · `[data-theme]` in `app/css/styles.css`
- [ ] Demo credentials → `lib/auth/providers.ts` · `prisma/seed.ts` · `components/auth/signin-form.tsx`
- [ ] Theme CSS → `admin/internal/theme/css` and `src/app/css` must stay byte-synced
- [ ] Port 6020 → `playwright.config.ts` `baseURL` · `NEXTAUTH_URL` · dev scripts

## Dependencies

- Depends on: #
- Blocks: #

## Verification

- [ ] Unit / conformance (Vitest) — name the suite:
- [ ] E2E (Playwright) — name the spec:
- [ ] Seed fixture still reconciles to the cent
- [ ] Design QA at 390/768/1440 (UI-visible only)
- [ ] Verified by hand in the running app

## Risks
