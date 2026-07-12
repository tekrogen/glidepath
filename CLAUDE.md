# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. What follows are behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Rules

These must be followed with no exceptions:

1. Do not ever include an AI or Bot generated `Co-Authored` code such as: `Co-Authored-By: Claude …` or `Co-Authored-By: Fable …` trailer in commits in this code base.
2. **Check files first, assume nothing.** When there is any confusion, contradiction, or ambiguity — especially about what this project *is*, what it references, or how it relates to other projects (the DS repo, the two surfaces, vendored vs authored code) — verify against the documents, the data, and the codebase (README, CLAUDE.md, `git remote -v`, `git log`, `grep`) *before* answering or acting. Treat the repository's own files as authoritative over anything stated in chat, including loosely-worded inputs and your own prior statements. Report what the files say, then reason. Never carry an unverified claim from conversation forward as fact.
3. **Follow the branch-naming convention** (see Governance): `<type>/<issue#>-<slug>`, issue first, PR body `Closes #N`.
4. **Review and validate every UI/UX artifact before declaring it done.** Any UI/UX you author or change here (a mockup surface, a screen, an `admin/review/` artifact, any HTML/CSS) must be (a) **designed to the expert review method** and (b) **validated against the Tekrogen Brand Design System** — *before* hand-off, not after the user reports a defect. The operating brief lives in **`/Volumes/SERV01-DTMAC/_Code_Library/AI prompts/`** — read it when doing this work:
- **`Design-System-UIUX-Review-Prompt.md`** — the **expert panel** (Senior Product Designer · Design Systems Architect · Front-End Engineering Lead · Visual/UI Designer): visual hierarchy/legibility, token/scale/spacing discipline. Apply every lens the brief defines; be evidence-based.
5. **Agents** – the agents live in `/Volumes/SERV01-DTMAC/_Code_Library/AI Agents/` (additional agent definitions in `/Volumes/SERV01-DTMAC/_Code_Library/.claude/agents/`)
6. **Canonical documentation only.** Every planning document must reference only canonical documentation — one authoritative file per topic (architecture: `admin/internal/features-planning/architecture/README.md`; plan: `admin/internal/planning/PRODUCTION-BLUEPRINT.md`). Superseded versions are archived, not left in place; a document that cites a broken or non-canonical path is a defect.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project Notes — Credit Card Manager

Project-specific conventions and gotchas. The behavioral guidelines above still apply.

### Running the app

- Dev server runs on **port 6014** (`pnpm dev`, `pnpm dev:https`, `pnpm start` all pin it). If Next reports "Port 6014 is in use" and falls back to another port, a stale server is running — kill it; auth breaks on the fallback port because `NEXTAUTH_URL` is port-specific.
- `pnpm dev:https` auto-generates certificates into `certificates/` (gitignored) via Next's `--experimental-https`. When using HTTPS regularly, set `NEXTAUTH_URL=https://localhost:6014`; keep `http://` for plain `pnpm dev`.
- **Env file is `.env`, not `.env.local`** — the Prisma CLI only loads `.env`; Next.js loads both. Everything (README, seed, scripts) assumes `.env`.

### Data conventions (load-bearing)

- **RBAC**: USER and ADMIN are orthogonal — ADMIN has *no* `financial:*` permissions by design. An admin sees an empty dashboard; that is intentional, not a bug.
- **Money**: new card-domain tables store integer minor units (`BigInt` cents) + ISO currency; APRs are integer basis points (2274 = 22.74%). Legacy v1 tables stay `Decimal` until their domain migrates (EDR-008). `bigint` cannot cross the RSC → client-component prop boundary — serialize as `number` cents.
- **All financial math lives in `src/lib/finance`** (pure, no I/O). Math in a component, page, or route file is a review-blocking defect (EDR-019). Interest figures are simple estimates (balance × APR ÷ 12) and always render with the `~` EstimatedValue component (EDR-020).
- **One status engine**: `src/features/cards/utils/card-status.ts` is the only alert/badge derivation path. FROZEN outranks alerts; connection/sync state never appears in the status badge.
- **Never key or match cards on last-four** — real portfolios contain duplicates (it's a seeded test fixture).

### Theme & UIUX sources (EDR-013 — final; two earlier readings were wrong)

- **UIUX architecture** (shell, sidebar IA, page composition, headers) follows the **mockup** in `admin/internal/theme/credit-card-manager-mockup/` and the newest wireframes in `admin/internal/features-planning/`.
- **Colors, tokens, and fonts** come exclusively from **`admin/internal/theme/css`**, which must stay byte-synced with `src/app/css` (edit both together). Wealth palette, Inter body / Syne headings, light + dark.
- The mockup is **never** a visual/token source, and Glidepath is **not** an Ebia iteration — Ebia donates component idiom only where it fits the theme.
- Enforced by `tests/e2e/theme-and-shell.spec.ts` (computed-token + sidebar-IA conformance). When theme values change, update that spec's expected constants deliberately.

### Local environment

- **PostgreSQL runs via Postgres.app** (localhost:5432), *not* Docker — `docker-compose.yml` exists for other environments but don't start Docker for the DB here.
- **Phone/LAN testing**: `pnpm dev:lan` (detects the LAN IP, binds 0.0.0.0, overrides `NEXTAUTH_URL` for the run). Plain `pnpm dev` breaks sign-in from other devices because `NEXTAUTH_URL` pins localhost/https → secure cookies dropped + unreachable redirects. Google/GitHub OAuth only work on provider-registered hosts — use demo credentials on LAN.
- **`admin/internal/` is local-only by design** (gitignored): the planning corpus, Production Blueprint, phase-gate records, and real tracker data never reach the public repo.

### Workflow (phase gates + PRs)

- Every code change: issue → `<type>/<issue#>-<slug>` branch → PR (`Closes #N`) → CI green → **squash-merge with a plain conventional title**. Branch protection on `main` requires both CI checks; admins exempt for emergencies.
- Phases exit through the checklist in `admin/internal/planning/PHASE-GATES.md` (CI green, verify criteria, issue triage — no open critical/high for the phase, design QA for UI, release cut). Defects are filed as issues the moment they're found.
- The seed **is** the test fixture (`SEED_VERSION 2` = the Hi-Fi dataset; tiles reconcile to the cent). Changing seed data or a finance formula must update the conformance suites knowingly — a to-the-cent test failure means the spec changed or the code is wrong, never "flaky".

### Things that must stay in sync (change one → change all)

- **Color theme names** (`blue`/`orange`/`midnight`) live in three places: `lib/themes.ts`, the anti-FOUC inline script in `app/layout.tsx`, and the `[data-theme="..."]` blocks in `app/css/styles.css`.
- **Demo credentials** live in three places: `lib/auth/providers.ts` (`DEMO_USER`), `prisma/seed.ts` (`DEMO_EMAIL`), and `components/auth/signin-form.tsx` (autofill constants).



### E2E (Playwright)

- **Three projects**: `setup` (demo login → `tests/.auth/user.json`), `public` (no session), `authenticated` (reuses storageState). Config: `playwright.config.ts`.
- **`pnpm test:e2e`** seeds the DB and starts the dev server when none is running (`webServer.command`). In CI set `CI=true` for a fresh server every run.
- **Demo auth in tests**: `webServer.env` sets `ENABLE_DEMO_AUTH=true`; do not reference Ebia's `ENABLE_TEST_AUTH` — it does not exist here.
- **Port 6014** is hardcoded in `baseURL`, `NEXTAUTH_URL`, and dev scripts; keep them aligned.

### Releases and commits

- **Release Please** drives versioning from conventional commit headers on `main`. The husky hook auto-prefixes local commits with an emoji (`✨ feat: ...`), which Release Please **cannot parse** — so feature PRs must be **squash-merged with a plain conventional title** (no emoji). Branch commits can keep the emoji style.
- Version baseline: `.release-please-manifest.json` at `1.0.0`, matching the `v1.0.0` tag on the initial commit.
- **CHANGELOG.md updates only when a Release Please PR merges** (never per commit); that merge creates the git tag and the GitHub Release together. The repo setting "Allow GitHub Actions to create and approve pull requests" must stay enabled or Release Please fails silently on every push.
- CI runs on bot-created PRs may show "action required" (GitHub holds workflow approval for bots) — main's own push run is the authoritative signal.
