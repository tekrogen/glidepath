# CLAUDE.md

This file defines the operating rules for Claude Code and other AI coding assistants working in this repository.

These instructions are intended to reduce common AI-assisted coding mistakes, protect project-specific business rules, and ensure that work is grounded in the repository's authoritative documentation.

Project-specific instructions may extend these rules, but they must not silently override them.

> **Operating bias:** Favor correctness, verification, and minimal changes over speed. Use judgment for truly trivial tasks.

---

# 1. Non-Negotiable Rules

The following rules apply without exception.

## 1.1 Never add AI attribution to commits

Do not add AI-generated authorship or co-authorship trailers to commits.

Prohibited examples include:

```text
Co-Authored-By: Claude ...
Co-Authored-By: Fable ...
```

Do not add equivalent attribution for any other AI assistant, agent, or bot.

---

## 1.2 Verify repository facts before acting

Repository files are the source of truth.

When there is confusion, contradiction, ambiguity, or uncertainty, verify the relevant facts against the repository before answering or changing code.

This is especially important when determining:

* what the project is
* which repository or surface is being discussed
* how this project relates to other repositories
* whether code is authored, generated, copied, or vendored
* which documentation is current
* which implementation path is canonical
* whether a statement from chat is accurate

Use the appropriate repository evidence, including:

```bash
README.md
CLAUDE.md
git remote -v
git log
grep
```

Also inspect the relevant code, configuration, documentation, tests, and data.

Treat repository evidence as authoritative over:

* loosely worded user messages
* chat history
* prior AI statements
* model memory
* unverified assumptions

Report what the repository says before reasoning from it.

Never carry an unverified claim from conversation forward as fact.

---

## 1.3 Follow repository governance

Every code change must follow the project's governance process.

Branch names must use:

```text
<type>/<issue#>-<slug>
```

Requirements:

* Put the issue number before the slug.
* Reference the issue in the pull request.
* Include `Closes #N` in the pull request body.
* Follow the repository's merge and release conventions.
* Do not invent an alternative workflow.

See the project workflow section below for the complete process.

---

## 1.4 Review and validate every UI/UX artifact

Any UI or UX artifact created or modified in this repository must be reviewed before it is declared complete.

This applies to:

* application screens
* mockup surfaces
* prototypes
* `admin/review/` artifacts
* page layouts
* components
* HTML
* CSS
* design tokens
* responsive behavior
* visual documentation

Every UI/UX artifact must satisfy both requirements below.

### A. Use the expert review method

The operating brief is stored in:

```text
/Volumes/SERV01-DTMAC/_Code_Library/AI prompts/
```

For UI/UX work, read and apply:

```text
/Volumes/SERV01-DTMAC/_Code_Library/AI prompts/Design-System-UIUX-Review-Prompt.md
```

This file defines the required expert review panel:

* Senior Product Designer
* Design Systems Architect
* Front-End Engineering Lead
* Visual/UI Designer

Apply every review lens defined in the brief.

The review must be evidence-based and must address, at minimum:

* visual hierarchy
* readability and legibility
* typography
* scale
* spacing
* alignment
* component consistency
* design-token discipline
* responsive behavior
* implementation quality

Do not substitute a general visual opinion for the prescribed review method.

### B. Validate against the Tekrogen Brand Design System

Before hand-off, verify that the artifact conforms to the Tekrogen Brand Design System and the repository's approved theme sources.

Validation must happen before declaring the work complete—not after the user reports a defect.

A UI/UX change is incomplete until both the expert review method and brand-system validation have been performed.

---

## 1.5 Use the approved agent definitions

Reusable AI agents are stored in:

```text
/Volumes/SERV01-DTMAC/_Code_Library/AI Agents/
```

Additional Claude-specific agent definitions are stored in:

```text
/Volumes/SERV01-DTMAC/_Code_Library/.claude/agents/
```

Use these directories when:

* delegating work to a specialized agent
* locating an existing agent definition
* selecting an expert role
* coordinating independent subtasks
* determining an agent's expected behavior or output

Do not recreate an agent that already exists in the approved agent library.

Before using or modifying an agent, inspect its definition and preserve its intended scope.

When multiple agent definitions appear relevant, choose the most specific definition supported by the task.

---

## 1.6 Use canonical documentation only

Each topic must have one authoritative document.

Planning documents, implementation plans, issue descriptions, agent outputs, and technical references must cite only canonical documentation.

The canonical architecture source is:

```text
admin/internal/features-planning/architecture/README.md
```

Its purpose is to define the approved system architecture, architectural boundaries, and current architectural decisions.

The canonical production plan is:

```text
admin/internal/planning/PRODUCTION-BLUEPRINT.md
```

Its purpose is to define the authoritative implementation plan, sequencing, phase expectations, and production roadmap.

Requirements:

* Do not cite superseded versions.
* Do not leave obsolete copies beside canonical files.
* Archive superseded documents.
* Do not create competing authoritative documents.
* Do not reference broken paths.
* Do not use historical documents as current requirements.
* Confirm that referenced paths exist before publishing planning material.

A planning document that cites a broken, superseded, or non-canonical path is defective.

---

# 2. Think Before Coding

Do not assume. Do not conceal uncertainty. Surface meaningful tradeoffs.

Before implementing:

* State material assumptions explicitly.
* Verify uncertain repository facts.
* Identify competing interpretations when they affect the result.
* Present meaningful tradeoffs instead of silently choosing.
* Point out a simpler approach when one exists.
* Push back when the requested approach is unnecessarily complex or conflicts with project rules.
* Stop only when progress genuinely requires information the user alone can provide.

Do not ask questions merely to avoid making a reasonable, reversible decision.

---

# 3. Autonomous Execution

Operate autonomously within the user's original request.

The user may not be watching in real time and may not be available to answer questions during execution.

For actions that are reversible and clearly implied by the request:

* proceed without asking
* verify the result
* report what was done

Do not block work with questions such as:

* “Want me to continue?”
* “Shall I make the change?”
* “Would you like me to run the tests?”

If those actions are already implied by the task, perform them.

Pause only when the work requires:

* a destructive action
* an irreversible action
* a genuine scope change
* credentials or secrets
* a business decision only the user can make
* information that cannot be determined from the repository

Before ending a task, inspect the final paragraph of your response.

Do not end with:

* an unexecuted plan
* a promise of future work
* a list of steps you could perform now
* a question that unnecessarily blocks completion
* “I will...”
* “Let me know when...”

Complete the work before ending whenever the required tools and information are available.

---

# 4. Delegate Independent Work Appropriately

Delegate independent subtasks to approved agents when doing so improves accuracy or throughput.

Use the approved agent definitions from:

```text
/Volumes/SERV01-DTMAC/_Code_Library/AI Agents/
```

and:

```text
/Volumes/SERV01-DTMAC/_Code_Library/.claude/agents/
```

Continue working on independent tasks while delegated work is in progress.

Review all delegated output before using it.

Intervene when an agent:

* drifts from scope
* ignores repository rules
* lacks necessary context
* references non-canonical documentation
* proposes unsupported assumptions
* returns unverifiable conclusions

Delegation does not transfer responsibility. The primary assistant remains responsible for the final result.

---

# 5. Simplicity First

Implement the minimum code that correctly solves the requested problem.

Do not add:

* features that were not requested
* abstractions for one-time behavior
* speculative configurability
* generalized frameworks without an immediate need
* error handling for impossible scenarios
* premature extension points
* unrelated cleanup

If an implementation is substantially larger than necessary, simplify it.

Ask:

> Would a senior engineer consider this overcomplicated?

If the answer is yes, reduce the solution.

---

# 6. Make Surgical Changes

Touch only what the task requires.

When editing existing code:

* Match the existing style.
* Preserve established patterns.
* Avoid unrelated refactoring.
* Avoid opportunistic cleanup.
* Avoid formatting unrelated files.
* Do not rewrite comments that are outside the task.
* Do not “improve” adjacent code merely because you noticed it.
* Mention unrelated defects rather than silently fixing them.

When your changes create unused code:

* Remove imports made unused by your changes.
* Remove variables made unused by your changes.
* Remove functions made unused by your changes.
* Do not remove pre-existing dead code unless requested.

Every changed line should trace directly to the user's request or to verification required by that request.

---

# 7. Define Success Before Implementation

Translate requests into verifiable outcomes.

Examples:

```text
“Add validation”
→ Write or identify tests for invalid input, implement validation, and verify the tests pass.
```

```text
“Fix the bug”
→ Reproduce the failure, add a regression test when appropriate, implement the fix, and verify the failure no longer occurs.
```

```text
“Refactor X”
→ Establish baseline behavior, perform the refactor, and verify behavior remains unchanged.
```

For multi-step tasks, use a concise execution plan:

```text
1. [Action] → verify: [evidence]
2. [Action] → verify: [evidence]
3. [Action] → verify: [evidence]
```

Strong success criteria enable independent execution.

Avoid vague criteria such as:

```text
Make it work.
Improve the code.
Clean this up.
```

Replace them with observable outcomes.

---

# 8. Verify Before Declaring Completion

Never declare work complete based only on code inspection or confidence.

Use the verification methods appropriate to the change:

* unit tests
* integration tests
* end-to-end tests
* type checking
* linting
* production builds
* runtime validation
* database validation
* visual review
* responsive testing
* design-system validation
* accessibility checks
* regression checks

For UI/UX work, verification must also follow:

```text
/Volumes/SERV01-DTMAC/_Code_Library/AI prompts/Design-System-UIUX-Review-Prompt.md
```

and the Tekrogen Brand Design System.

If a verification step cannot be run, state:

* which step was not run
* why it could not be run
* what evidence was used instead
* what remains unverified

Do not describe unverified work as fully validated.

---

# 9. Record Durable Lessons Carefully

Store one durable lesson per file.

Each lesson file must begin with a one-line summary.

Record:

* confirmed approaches
* corrections
* failed assumptions
* why the lesson mattered

Do not record:

* facts already documented by the repository
* information already preserved in chat history
* duplicate lessons
* speculative conclusions

Update an existing lesson rather than creating a duplicate.

Delete or correct lessons that are later proven wrong.

---

# 10. Project Notes — Credit Card Manager

The following rules are specific to the Credit Card Manager project.

The general behavioral rules above continue to apply.

---

## 10.1 Running the application

The development server runs on port:

```text
6020
```

The following commands are pinned to that port:

```bash
pnpm dev
pnpm dev:https
pnpm start
```

If Next.js reports that port `6020` is in use and falls back to another port, a stale development server is running.

Do not continue on the fallback port.

Authentication depends on a port-specific `NEXTAUTH_URL`, so a fallback port can break sign-in behavior.

Terminate the stale server and restart on port `6020`.

### HTTPS development

```bash
pnpm dev:https
```

This command uses Next.js experimental HTTPS support and generates certificates in:

```text
certificates/
```

The directory is gitignored.

When developing regularly over HTTPS, use:

```env
NEXTAUTH_URL=https://localhost:6020
```

For plain HTTP development, use:

```env
NEXTAUTH_URL=http://localhost:6020
```

### Environment file

The project uses:

```text
.env
```

Do not move required configuration exclusively to:

```text
.env.local
```

The Prisma CLI loads `.env`, while Next.js can load both files.

The project's README, seed process, and scripts assume `.env`.

---

## 10.2 Data conventions

These rules are load-bearing.

### Role-based access control

`USER` and `ADMIN` are orthogonal roles.

An `ADMIN` intentionally has no `financial:*` permissions.

As a result, an administrator may see an empty financial dashboard.

That behavior is intentional and must not be treated as a bug.

### Monetary values

New card-domain tables store money as:

* integer minor units
* `BigInt` cents
* ISO currency codes

APRs are stored as integer basis points.

Example:

```text
2274 = 22.74%
```

Legacy v1 tables remain on `Decimal` until their domain migration under EDR-008.

A JavaScript `bigint` cannot cross the React Server Component-to-client-component prop boundary.

Serialize monetary values passed to client components as numeric cents.

### Financial calculations

All financial mathematics belongs in:

```text
src/lib/finance
```

The code in this directory must remain pure and perform no I/O.

Financial calculations in any of the following are review-blocking defects:

* components
* pages
* route handlers
* UI utilities outside the finance domain

This rule is governed by EDR-019.

Interest values are simple estimates:

```text
balance × APR ÷ 12
```

Estimated interest values must render using the `EstimatedValue` component with a `~` indicator.

This rule is governed by EDR-020.

### Card status derivation

The only approved card alert and badge derivation path is:

```text
src/features/cards/utils/card-status.ts
```

Do not create parallel status logic.

Rules:

* `FROZEN` outranks alert states.
* Connection state must not appear in the card status badge.
* Synchronization state must not appear in the card status badge.

### Card identity

Never key, deduplicate, or match cards using the last four digits.

Real card portfolios can contain duplicate last-four values, and the seed data intentionally includes this case.

---

## 10.3 Theme and UI/UX sources

EDR-013 is final.

Two earlier interpretations were incorrect and must not be reintroduced.

### UI architecture source

Application shell, sidebar information architecture, page composition, and page headers follow:

```text
admin/internal/theme/credit-card-manager-mockup/
```

and the newest wireframes in:

```text
admin/internal/features-planning/
```

The mockup defines structural and compositional direction.

### Theme source

Colors, design tokens, and fonts come exclusively from:

```text
admin/internal/theme/css
```

This directory must remain byte-synchronized with:

```text
src/app/css
```

When changing theme CSS, edit both locations together.

The approved visual system includes:

* Wealth palette
* Inter for body text
* Syne for headings
* light mode
* dark mode

### Source boundaries

The mockup is not a color, token, or font source.

Glidepath is not an Ebia iteration.

Ebia may contribute component idioms only when those idioms fit the approved theme.

### Automated enforcement

Theme and shell conformance are enforced by:

```text
tests/e2e/theme-and-shell.spec.ts
```

The test validates:

* computed token values
* sidebar information architecture

When theme values intentionally change, update the expected constants in this test deliberately.

Do not weaken the test merely to make a change pass.

### Required external UI/UX review source

All UI/UX work must additionally be reviewed using:

```text
/Volumes/SERV01-DTMAC/_Code_Library/AI prompts/Design-System-UIUX-Review-Prompt.md
```

This external operating brief defines the expert review method and must be used alongside the repository-specific theme sources.

---

## 10.4 Local environment

PostgreSQL runs through Postgres.app at:

```text
localhost:5432
```

Do not start Docker for the local database.

A `docker-compose.yml` file exists for other environments, but it is not the source of truth for local database execution.

### Phone and LAN testing

Use:

```bash
pnpm dev:lan
```

This command:

* detects the LAN IP
* binds the application to `0.0.0.0`
* overrides `NEXTAUTH_URL` for the current run

Do not use plain `pnpm dev` for testing authentication from another device.

Plain development mode pins authentication to localhost or HTTPS and can cause:

* secure cookies to be dropped
* redirects to unreachable localhost addresses
* failed sign-in behavior

Google and GitHub OAuth work only on provider-registered hosts.

Use demo credentials during LAN testing.

### Local-only administrative files

The following directory is intentionally local-only:

```text
admin/internal/
```

It is gitignored by design.

It contains:

* the planning corpus
* the Production Blueprint
* phase-gate records
* real tracker data

Do not attempt to publish these files to the public repository.

Do not assume that their absence from Git means they are obsolete.

---

## 10.5 Workflow, phase gates, and pull requests

Every code change follows this sequence:

```text
Issue
→ branch
→ pull request
→ CI green
→ squash merge
```

Branch format:

```text
<type>/<issue#>-<slug>
```

Pull request body:

```text
Closes #N
```

Merge requirements:

* CI must be green.
* Use squash merge.
* Use a plain conventional commit title.
* Do not include an emoji in the squash-merge title.

Branch protection on `main` requires both CI checks.

Administrators are exempt only for emergencies.

### Phase gates

Phases exit through:

```text
admin/internal/planning/PHASE-GATES.md
```

The phase-exit checklist includes:

* CI green
* verification criteria satisfied
* issue triage complete
* no open critical or high-severity issues for the phase
* design QA complete for UI work
* release cut complete

File defects as issues when they are discovered.

Do not defer known defects without recording them.

### Seed data

The seed is the test fixture.

```text
SEED_VERSION 3
```

This version represents:

* the high-fidelity dataset
* the payment-domain fixture

Dashboard tiles must reconcile to the cent.

Changing seed data or a financial formula requires deliberate updates to the relevant conformance suites.

A to-the-cent test failure means one of two things:

* the specification changed
* the code is wrong

Do not classify it as flaky without evidence.

---

## 10.6 Files that must remain synchronized

### Theme names

The following theme names must stay synchronized:

```text
blue
orange
midnight
```

They are defined in three locations:

```text
lib/themes.ts
app/layout.tsx
app/css/styles.css
```

Specifically:

* `lib/themes.ts` defines the available themes.
* `app/layout.tsx` contains the anti-FOUC inline script.
* `app/css/styles.css` contains the `[data-theme="..."]` blocks.

When changing one, update all three.

### Demo credentials

Demo credentials must stay synchronized across:

```text
lib/auth/providers.ts
prisma/seed.ts
components/auth/signin-form.tsx
```

Relevant constants include:

```text
DEMO_USER
DEMO_EMAIL
autofill constants
```

When changing demo credentials, update all three locations.

---

## 10.7 End-to-end testing

Playwright defines five projects:

```text
setup
public
authenticated
authenticated-mutations
empty-state
```

### Setup project

The `setup` project performs demo authentication and writes session state to:

```text
tests/.auth/user.json
```

### Public project

The `public` project runs without an authenticated session.

### Authenticated project

The `authenticated` project reuses the generated storage state.

It contains only read-only specs that assert the seed-exact fixture.

### Authenticated-mutations project

The `authenticated-mutations` project holds the specs that insert real rows, such as add-card, imports, and payment flows.

It depends on the `authenticated` project, so mutations run strictly after the seed-exact read-only assertions.

### Empty-state project

The `empty-state` project runs as a separate card-less user with its own storage state:

```text
tests/.auth/empty.json
```

It depends only on `setup` and never orders against the seeded-fixture specs.

The Playwright configuration is:

```text
playwright.config.ts
```

### Running E2E tests

```bash
pnpm test:e2e
```

This command:

* seeds the database
* starts the development server when one is not already running

Server startup is controlled through:

```text
webServer.command
```

In CI, set:

```env
CI=true
```

This forces a fresh server for each run.

### Demo authentication in tests

The Playwright `webServer.env` configuration sets:

```env
ENABLE_DEMO_AUTH=true
```

Do not reference:

```env
ENABLE_TEST_AUTH
```

That variable belongs to Ebia and does not exist in this project.

### Port consistency

Port `6020` is hardcoded in:

* Playwright `baseURL`
* `NEXTAUTH_URL`
* development scripts

Keep all three aligned.

---

## 10.8 Releases and commits

Release Please controls versioning using conventional commit headers on `main`.

The local Husky hook automatically prefixes branch commits with an emoji.

Example:

```text
✨ feat: add card filter
```

Release Please cannot parse that format correctly on `main`.

Therefore, feature pull requests must be squash-merged with a plain conventional title.

Example:

```text
feat: add card filter
```

Do not include the emoji in the squash-merge title.

Branch commits may retain the emoji style.

### Version baseline

The version baseline is:

```text
1.0.0
```

It is stored in:

```text
.release-please-manifest.json
```

It matches the tag:

```text
v1.0.0
```

on the initial commit.

### Changelog behavior

Update `CHANGELOG.md` only when a Release Please pull request merges.

Do not update it for each commit or feature pull request.

Merging the Release Please pull request creates:

* the Git tag
* the GitHub Release
* the changelog update

The repository setting that allows GitHub Actions to create and approve pull requests must remain enabled.

If it is disabled, Release Please may fail silently on every push.

### Bot-created pull requests

CI runs on bot-created pull requests may display:

```text
action required
```

GitHub may hold those workflows for approval.

The `main` branch push run is the authoritative signal.

---

# 11. Completion Standard

These instructions are working when they produce:

* fewer unnecessary changes
* smaller and more reviewable diffs
* fewer rewrites caused by overengineering
* fewer assumptions presented as facts
* earlier detection of ambiguity
* consistent use of canonical documentation
* UI work validated before hand-off
* project rules preserved across sessions
* verified outcomes instead of confidence-based completion

The goal is not merely to produce code.

The goal is to produce the smallest correct change, grounded in authoritative project evidence, validated against the project's technical and business rules.
