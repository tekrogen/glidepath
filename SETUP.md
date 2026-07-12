# Setup Guide

The demo runs with zero external keys (see the README quick start). This guide
covers connecting the optional services: Plaid, OAuth sign-in, and AI insights.

## 1. Plaid (link real or sandbox accounts)

### Get your keys (~5 minutes)

1. Create a free account at [dashboard.plaid.com](https://dashboard.plaid.com/signup).
2. Go to **Developers → Keys** and copy:
   - `client_id` → `PLAID_CLIENT_ID`
   - the **Sandbox** secret → `PLAID_SECRET`
3. In your `.env`:

```bash
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
PLAID_ENCRYPTION_KEY=$(openssl rand -hex 32)   # encrypts access tokens at rest
```

4. Restart the dev server. The **Connect account** button in Settings now
   opens Plaid Link.

### Test in sandbox

Inside Plaid Link, pick any institution and sign in with Plaid's sandbox test
credentials:

> username **user_good** / password **pass_good**

Accounts and up to 24 months of test transactions sync automatically after
linking. Use the **Sync** button on a connected account to refresh manually.

### OAuth banks (redirect flow)

Institutions like Chase authenticate on their own site and redirect back.
Register the redirect URI in the Plaid dashboard under
**Developers → API → Allowed redirect URIs**:

```
http://localhost:6014/connect-account          # dev
https://yourdomain.com/connect-account         # production
```

…and set the same value as `PLAID_REDIRECT_URI` in `.env`.

### Webhooks (automatic syncs)

Plaid pushes `TRANSACTIONS` webhooks when new data is ready. Set
`PLAID_WEBHOOK_URL` to a public HTTPS endpoint that reaches
`/api/webhooks/plaid`:

- **Production**: `https://yourdomain.com/api/webhooks/plaid`
- **Local dev**: use a tunnel (`cloudflared tunnel`, `ngrok http 6014`) and use
  the tunnel URL.

Webhook signatures are verified with Plaid's JWT verification and **fail
closed** — unsigned requests are rejected. For local experiments only, you can
set `PLAID_WEBHOOK_SKIP_VERIFY=true` (never in production).

### Cleanup cron

`POST /api/cron/plaid-cleanup` removes long-disconnected items and revokes
expired-consent items. Protect it with `CRON_SECRET` and schedule it daily.
Vercel example (`vercel.json`):

```json
{ "crons": [{ "path": "/api/cron/plaid-cleanup", "schedule": "0 6 * * *" }] }
```

(Vercel sends `Authorization: Bearer $CRON_SECRET` when the env var is set.)

### Going to production

Production access requires [Plaid's approval process](https://dashboard.plaid.com/overview/production)
(security questionnaire + use-case review). Once approved:

```bash
PLAID_ENV=production
PLAID_SECRET=your_production_secret
```

Note Plaid bills per connected item in production — review their pricing.

## 2. OAuth sign-in (optional)

Sign-in buttons appear automatically when a provider's env vars are set.

**Google** — [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
→ Create OAuth 2.0 Client ID:

- Authorized redirect URI: `http://localhost:6014/api/auth/callback/google`
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**GitHub** — [github.com/settings/developers](https://github.com/settings/developers)
→ New OAuth App:

- Callback URL: `http://localhost:6014/api/auth/callback/github`
- Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

To make yourself a platform admin, add your email to `ADMIN_EMAIL` before your
first sign-in. Note ADMIN is a platform role with **no** financial data access
by design — use a regular USER account for day-to-day use.

## 3. AI insights (optional)

1. Get an API key at [console.anthropic.com](https://console.anthropic.com/).
2. In `.env`:

```bash
ENABLE_AI_INSIGHTS=true
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5   # or any current Claude model
```

3. `POST /api/ai/insights` (or the dashboard's refresh action) generates fresh
   insights from spending, budgets, and recurring charges. With the flag off,
   the widget shows curated mock insights.

## 4. Demo auth — read before deploying

`ENABLE_DEMO_AUTH=true` registers a credentials provider with **public**
credentials (`demo@glidepath.cards` / `demo-password`). This is
intentional so a deployed sales/preview instance offers one-click sign-in —
but anyone on the internet can sign in to that demo user.

**Before deploying with real users or real Plaid data set both:**

```bash
ENABLE_DEMO_AUTH=false
NEXT_PUBLIC_ENABLE_DEMO_AUTH=false
```

## 5. Database migrations

The quick start uses `pnpm db:push` (schema sync, great for dev). For
production, switch to real migrations:

```bash
pnpm db:migrate       # creates prisma/migrations/... from schema changes
npx prisma migrate deploy   # in CI/production
```


## Testing on your phone (LAN)

`NEXTAUTH_URL` in `.env` points at `localhost` (or `https://localhost` for
`dev:https`), so opening the app from another device via your machine's LAN IP
breaks sign-in: NextAuth issues cookies and redirects for the configured URL,
not the one your phone used — the failure is silent.

Use the LAN dev mode instead:

```bash
pnpm dev:lan
```

It detects your LAN IP, binds the server to all interfaces, and overrides
`NEXTAUTH_URL` to `http://<your-ip>:6014` for that run. Open the printed URL
on your phone and sign in with the demo credentials.

**Google/GitHub OAuth do not work over LAN IPs** — providers only redirect to
hosts registered in their consoles (`http://localhost:6014` is what's
registered). On a phone, use the demo credentials.
