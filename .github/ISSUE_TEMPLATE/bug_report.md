---
name: Defect
about: Something in Glidepath is broken
title: ""
labels: type:defect
assignees: ""
---

<!--
Title rule: state the broken behavior, not the fix.
Good: "Stepper note input silently truncates at 200 characters"
Bad:  "Fix note input"

Before submitting, add the two labels this template can't set for you:
  phase:N      which phase owns it (1-5)
  severity:*   critical | high | medium | low
Critical and high block that phase's gate (PHASE-GATES.md check #5).
-->

## Description

What is broken, in one or two sentences.

## Surface

Which part of the app? (Overview · Cards · Payment Runway · Swipe Matrix · Wallet · Manage · Settings · onboarding/import · auth · other)

## Environment

| Setting | Value |
|---|---|
| Node | `node -v` |
| pnpm | `pnpm -v` |
| Run mode | `pnpm dev` (6020) · `pnpm dev:https` · `pnpm dev:lan` |
| Browser / device | e.g. Chrome 140, iPhone Safari |
| OS | |
| Seed version | see `prisma/seed.ts` `SEED_VERSION` |
| Data | seeded demo · real tracker import · other |

## Steps to reproduce

1.
2.
3.

## Expected

## Actual

## Error output

```
Console, server log, or stack trace.
```

## Breadth (responsive + appearance)

Only for UI defects — design QA runs at these breakpoints (gate check #4).

- [ ] 390 (mobile)
- [ ] 768 (tablet)
- [ ] 1440 (desktop)
- [ ] Light mode
- [ ] Dark mode
- [ ] Theme: blue / orange / midnight

## Troubleshooting already tried

- [ ] Confirmed the dev server is actually on **6020** (a fallback port breaks auth — `NEXTAUTH_URL` is port-specific)
- [ ] Confirmed Postgres is up (Postgres.app on localhost:5432, not Docker)
- [ ] `pnpm db:generate` after a schema change
- [ ] Re-seeded (`pnpm db:seed`) and re-checked
- [ ] Signed out and back in
- [ ] Checked `.env` (not `.env.local` — the Prisma CLI only reads `.env`)

## Money / math impact

Answer if the defect touches a dollar figure, APR, utilization, or a due date.

- [ ] A displayed figure is wrong
- [ ] An estimated figure renders without the `~` / EstimatedValue treatment (EDR-020)
- [ ] Math appears outside `src/lib/finance` (review-blocking, EDR-019)
- [ ] A conformance test disagrees with the seed fixture to the cent
- [ ] No money impact

## Screenshots

---

### Maintainer checklist

- [ ] Reproduced
- [ ] Root cause identified
- [ ] Fix landed via PR (`Closes #N`, squash title has no emoji)
- [ ] Test added or updated (Vitest and/or Playwright)
- [ ] Resolution comment posted (see `resolution_template.md`)
