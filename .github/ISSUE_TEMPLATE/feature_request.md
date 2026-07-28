---
name: Feature request
about: Propose a new capability or an improvement to an existing one
title: ""
labels: enhancement
assignees: ""
---

<!--
Before submitting, add: phase:N (which phase should own this).
If it doesn't belong to a phase yet, leave it off and say so under Phase below.
-->

## Problem

What can't be done today, or what is painful. Describe the situation, not the solution.

## Proposed capability

## Surface

- [ ] Overview (dashboard)
- [ ] Cards / card rack / card detail
- [ ] Payment Runway (`/payments`, stepper, history)
- [ ] Swipe Matrix (rewards)
- [ ] Wallet (mobile companion)
- [ ] Manage (import, household, accounts)
- [ ] Settings / theming / auth
- [ ] Transactions / Insights
- [ ] Domain logic (`src/lib/finance`, status engine, attention engine)
- [ ] Infrastructure (CI, deploy, Plaid, seed)

## Who wants it and why

Marti (owner/power user) · household member · demo visitor · admin. Describe the workflow, not just the feature.

## Product boundary check

EDR-010: Glidepath plans and tracks payments — it is not a payment processor.

- [ ] This does **not** initiate a payment, move money, or take custody of funds
- [ ] This does involve payment execution → requires a **new EDR** before any implementation

## Blueprint linkage

- Gap Register entry (G#), if this closes a known gap:
- EDR it depends on or would create:
- Wireframe / mockup screen that specifies it:
- If nothing above applies, say why this is new scope:

## Alternatives considered

## Phase

Which phase should own this, and why that one? (Phases 0–2 are closed; 3 = payments, 4 = rewards, 5 = completion + hardening.)

---

### Maintainer checklist

- [ ] Scope agreed and phase assigned
- [ ] Acceptance criteria written below
- [ ] Blueprint updated if this creates or changes an EDR
- [ ] Design reviewed if UI-visible (expert panel at 390/768/1440)
- [ ] Tests defined (Vitest for math, Playwright for flows)
