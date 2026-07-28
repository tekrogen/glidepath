---
name: Incident
about: Data loss, outage, security exposure, or anything that damaged real state
title: ""
labels: type:defect, severity:critical
assignees: ""
---

<!--
File this the moment the incident is known — before it is fixed, before it is understood.
Ported from Ebia's admin/internal/incidents/ convention (e.g. the 2026-07-23 real-DB wipe).

Adjust severity down only after the blast radius is actually known, never before.
-->

**Detected:** YYYY-MM-DD HH:MM
**Status:** ACTIVE / CONTAINED / RESTORED / CLOSED
**Reporter:**

## What happened

Plain narrative, in order. Times where known.

## Blast radius

- Environment: local / preview / production
- Data affected (be specific — tables, row counts, which household):
- Real financial data involved: yes / no
- Credentials or tokens exposed: yes / no
- Users affected:

## Root cause

The actual mechanism. Not "human error" — what made the error possible.

## Contributing failures

What let it get this far? Missing guard, missing confirmation, misleading command name, absent backup, ambiguous docs.

-
-

## Immediate remediation

What was done right away to stop the bleeding.

- [ ]
- [ ]

## Restore plan

How the correct state is recovered, step by step, with the verification for each step.

1. → verify:
2. → verify:

## Verification that it is actually fixed

- [ ] Data reconciles against a known-good source (tracker xlsx, backup, or seed)
- [ ] `pnpm test` green, including seed-fixture conformance to the cent
- [ ] Confirmed by hand in the running app

## Lessons

The part that matters. What changes so this cannot happen the same way twice.

-
-

## Follow-up issues

Each lesson that needs code or process work becomes its own issue.

- #
- #

---

> Do not close this until Lessons is filled in and every follow-up issue exists.
