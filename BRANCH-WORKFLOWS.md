# Branch Strategy

```
main (production-stable)
^
|  PR: uat → main (release)
|
uat (staging/QA)
^
|  PR: dev → uat (promotion)
|
dev (integration)
^
|  PR: feat/* → dev (feature merge)
|
feat/*, fix/*, refactor/* (feature branches from dev)
```

## Rules

1. Feature branches are created from dev, not main
2. dev = integration branch, all feature work merges here first
3. uat = staging, receives tested code from dev via PR
4. main = production, receives from uat only via PR
5. hotfix branches from main, merge to main AND back-merge to dev

---

## Git Worktrees

Each branch has its own directory on disk. You **do not** run `git checkout` to switch between main, dev, and uat. Instead, you `cd` to the right folder.

### Directory Layout

| Branch | Directory | Port |
|--------|-----------|------|
| `main` | `ebia` | 6006 |
| `dev` | `ebia-dev` | 6007 |
| `uat` | `ebia-uat` | 6008 |

All three directories are siblings under `~/WebstormProjects/`.

### Why This Matters

- `git checkout dev` from the main directory **will fail** — Git locks each branch to its worktree
- Each worktree has its own `node_modules/`, `.env.local`, and Prisma client
- You can run dev servers on all three simultaneously (ports 6006, 6007, 6008)
- Each directory is a fully independent workspace

### Listing Worktrees

```bash
git worktree list
```

### Setting Up a Worktree

After creating a new worktree, run the setup script to install dependencies, copy `.env.local`, generate the Prisma client, and build workspace packages:

```bash
./scripts/setup-worktree.sh --all          # setup all worktrees
./scripts/setup-worktree.sh <path> [port]  # setup a specific worktree
```

### Managing Worktrees

```bash
./scripts/worktree.sh list                 # list all worktrees with status
./scripts/worktree.sh create <branch>      # create a new worktree
./scripts/worktree.sh remove <branch>      # remove a worktree
./scripts/worktree.sh status               # show ahead/behind for each
```

---

## Daily Workflow

### 1. Start a Feature

```bash
cd ~/WebstormProjects/ebia-dev
git checkout -b feat/my-feature
# work here — the dev worktree is now on feat/my-feature
pnpm dev                    # runs on port 6007
```

### 2. Commit Changes

Commits use conventional format with auto-injected emoji via the husky commit-msg hook:

```bash
git add <files>
git commit -m "feat(scope): add new feature"
# hook auto-prepends emoji → "✨ feat(scope): add new feature"
```

### 3. Merge Feature into dev

```bash
git checkout dev
git merge feat/my-feature
git push origin dev
git branch -d feat/my-feature      # cleanup
```

Or via GitHub PR: `feat/my-feature` → `dev`

### 4. Promote dev to uat

```bash
./scripts/promote.sh dev-to-uat           # merge + push
./scripts/promote.sh dev-to-uat --dry-run # preview only
```

### 5. Promote uat to main

```bash
./scripts/promote.sh uat-to-main
```

### 6. Sync Back After Promotion

After promoting to main, sync the workflow files back down:

```bash
# from the main worktree
git checkout dev && git merge main && git push origin dev
git checkout uat && git merge main && git push origin uat
git checkout main
```

Or use the promote script's status command to check what's ahead/behind:

```bash
./scripts/promote.sh status
```

---

## HTTPS + Cloudflare Tunnel

For Plaid integration and external HTTPS access:

```bash
pnpm dev:tunnel
```

This runs concurrently:
- Next.js HTTPS dev server on `https://localhost:6014`
- Cloudflare tunnel named `ebia` routing traffic to localhost

### Tunnel Subdomains

| Environment | Subdomain | Port | Worktree |
|-------------|-----------|------|----------|
| main | `ebia.tekrogen.studio` | 6006 | `ebia` |
| dev | `dev.ebia.tekrogen.studio` | 6007 | `ebia-dev` |
| uat | `uat.ebia.tekrogen.studio` | 6008 | `ebia-uat` |

All three subdomains route through a single tunnel. Each resolves to the corresponding localhost port. The tunnel config lives at `~/.cloudflared/config.yml`.

Ctrl+C stops both Next.js and the tunnel.

---

## Commit Convention

Format: `[emoji] type[(scope)]: description`

| Type | Emoji | Example |
|------|-------|---------|
| feat | ✨ | `feat(auth): add OAuth flow` |
| fix | 🐛 | `fix(api): handle null response` |
| docs | 📝 | `docs: update README` |
| style | 🎨 | `style: fix indentation` |
| refactor | ♻️ | `refactor(db): simplify queries` |
| perf | ⚡ | `perf: optimize bundle size` |
| test | ✅ | `test(e2e): add login tests` |
| build | 🏗️ | `build: update dependencies` |
| ci | 👷 | `ci: add lint job` |
| chore | 🔧 | `chore: update config` |
| revert | ⏪ | `revert: undo feature X` |
| security | 🔒 | `security: fix XSS vulnerability` |
| deps | 📦 | `deps: bump prisma to 6.19` |

Emoji is auto-injected by the commit-msg hook — just write `feat: description` and the hook prepends the emoji.
