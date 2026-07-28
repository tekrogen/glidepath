# Resolution template

> **This is not an issue template.** GitHub will not offer it in the "New issue" picker
> (it has no front matter on purpose). Copy this format into a **comment** on an issue
> to document how it was resolved, then close the issue.
>
> Ported from Ebia. Glidepath does **not** run Ebia's `auto-close-resolved` workflow, so
> the literal string `Status: RESOLVED` has no automation behind it here — closing is manual,
> or happens when a PR with `Closes #N` merges.

---

## Root cause

What actually caused it. Not what changed — why it was wrong.

## Fixes applied

### `src/path/to/file.ts`

**What changed:** one line.

```ts
// Before

// After
```

## Layer check

- [ ] No financial math left a route or component (EDR-019)
- [ ] Status/alert derivation still goes through the one status engine
- [ ] No new `bigint` crosses the RSC → client boundary un-serialized
- [ ] Nothing new keys on last-four

## Results

| Check | Result |
|---|---|
| Original behavior no longer reproduces | |
| `pnpm lint` | |
| `pnpm typecheck` | |
| `pnpm test` (unit + conformance) | |
| `pnpm test:e2e` | |
| `pnpm build` | |
| Seed fixture reconciles to the cent | |

> A to-the-cent conformance failure is never "flaky" — either the spec changed or the code is wrong.

## Verification in the running app

Design QA applies to any UI-visible change (gate check #4).

- [ ] 390 · [ ] 768 · [ ] 1440
- [ ] Light · [ ] Dark
- [ ] Verified against the seeded demo data
- [ ] Verified against the real tracker import (if the change touches import or figures)

## Docs updated

- [ ] Blueprint EDR status or Gap Register row
- [ ] Phase-gate record, if this closed a gate item
- [ ] README / SETUP, if a command or convention changed
- [ ] Nothing needed

## Prevention

- [ ] Test added that would have caught this
- [ ] Validation added
- [ ] Convention documented so it isn't repeated
- [ ] Follow-up issue filed: #

---

**Resolved by:** PR #  ·  **Released in:** v
