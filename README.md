# Branded Search Explorer

Graph and table view of **branded search clicks** from Google Search Console, with period comparisons and optional **TikTok metric overlays**. Built for **Cloudflare Pages** — API secrets never ship to the browser.

## Features

- Line chart of daily branded search clicks (queries matching your keyword list)
- Business unit dropdown to filter all charts/tables by that unit's branded terms
- Compare current range to **prior year (same dates)** or **previous period (same length)**
- Summary table with totals and delta
- TikTok overlay (demo data until you add API credentials)
- OAuth via server-side Cloudflare Functions
- Dark, marketing-friendly UI — responsive on mobile

## Quick start (local)

### 1. Install

```bash
cd gsc/branded-search-explorer
npm install
```

### 2. Configure secrets

Copy `.env.example` to `.dev.vars` in this folder (Wrangler reads this for local Functions):

```bash
cp .env.example .dev.vars
```

Edit `.dev.vars` with values from your Google Cloud OAuth client (the JSON in the parent `gsc/` folder):

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `OAUTH_REDIRECT_URI` | `http://localhost:8788/api/auth/callback` for local dev |
| `GSC_SITE_URL` | Property in Search Console, e.g. `sc-domain:yoursite.com` or `https://www.yoursite.com/` |
| `BRANDED_KEYWORDS` | Legacy single keyword list (optional, best for small sets) |
| `BUSINESS_UNIT_KEYWORDS_JSON` | Preferred JSON mapping: business unit -> keyword list |
| `SESSION_SECRET` | Random string for signing session cookies |
Example `BUSINESS_UNIT_KEYWORDS_JSON`:

```json
{
  "all": ["spawn labs", "spawnlabs"],
  "consumer": ["requisite vibes", "rv audio"],
  "enterprise": ["spawnlabs ai", "spawn labs platform"]
}
```

Store that JSON as a single-line value in `.dev.vars` / Cloudflare Variables and Secrets.


### 3. Google Cloud Console setup

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → enable **Google Search Console API**
2. OAuth client → **Authorized redirect URIs**:
   - Local: `http://localhost:8788/api/auth/callback`
   - Production: `https://<your-pages-domain>/api/auth/callback`
3. Add your Google account as a user with access to the GSC property
4. Use the exact `GSC_SITE_URL` as shown in Search Console (Settings → property)

### 4. Run

```bash
npm run build
npm run pages:dev
```

Open `http://localhost:8788`, click **Connect Google**, and authorize read-only Search Console access.

For frontend-only hot reload during UI work:

```bash
npm run dev
```

(Vite proxies `/api` to port 8788 — run `pages:dev` in another terminal.)

## Deploy to Cloudflare Pages

Use a **Pages** project (Create application → **Pages** → Connect to Git), not a **Worker** project. Workers require a deploy command; Pages does not.

1. Push this folder to a Git repo (or upload via dashboard)
2. **Build command:** `npm run build`
3. **Build output directory:** `dist`
4. Add the same environment variables as `.dev.vars` under **Settings → Variables and Secrets** (Production)
5. Update `OAUTH_REDIRECT_URI` to your production URL
6. Add the production redirect URI in Google Cloud Console
7. **Retry deployment** after changing variables

**Important:** Do not commit a `wrangler.toml` unless you define variables there too. With `wrangler.toml` present, Cloudflare treats it as the source of truth and **dashboard variables may not reach Functions** — causing `OAuth is not configured` even when secrets are set in the UI.

Optional CLI:

```bash
npm run pages:deploy
```

## Security

- Client ID/secret and tokens are only used in **Cloudflare Functions** (`functions/`)
- Session stored in **HttpOnly** signed cookie (8-hour max age)
- No app user accounts — only Google OAuth for API access
- Do **not** commit `.dev.vars`, `.env`, or `client_secret*.json`

## TikTok

Connect a TikTok account (Sandbox **Target User**) to overlay followers, video views, likes, and engagement on the chart.

### 1. TikTok Developer Portal

In [TikTok for Developers](https://developers.tiktok.com/) → your app:

1. **Login Kit** → Web → redirect URI:
   - `https://gscbranded.pages.dev/api/tiktok/callback`
2. **Scopes**: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`
3. Add your TikTok account as a **Target User** (Sandbox)
4. Copy **Client key** and **Client secret** from the app credentials

### 2. Cloudflare environment variables

Under **Pages → Settings → Variables and Secrets** (Production):

| Variable | Description |
|----------|-------------|
| `TIKTOK_CLIENT_KEY` | App client key |
| `TIKTOK_CLIENT_SECRET` | App client secret |
| `TIKTOK_OAUTH_REDIRECT_URI` | `https://gscbranded.pages.dev/api/tiktok/callback` |
| `TIKTOK_FOLLOWER_HISTORY_URL` | Fallback only — ignored once `TIKTOK_FOLLOWERS_KV` is bound. Optional path/URL for a static follower history JSON (default: `/tiktok-followers.json`) |

For local dev, add the same keys to `.dev.vars`. Use `http://localhost:8788/api/tiktok/callback` as redirect URI only if you register that URL in TikTok too.

### 3. Authorize the Target User

1. Deploy (or run `npm run pages:dev` after `npm run build`)
2. Open **`https://gscbranded.pages.dev/api/tiktok/oauth`**
3. Log in as the Target User and approve the requested scopes
4. TikTok redirects to `/api/tiktok/callback` — copy the JSON `cloudflare_variables` block into Cloudflare:

| Variable | Description |
|----------|-------------|
| `TIKTOK_ACCESS_TOKEN` | Short-lived token (~24h) |
| `TIKTOK_REFRESH_TOKEN` | Long-lived token — app auto-refreshes access when API calls fail |
| `TIKTOK_OPEN_ID` | TikTok user ID for the connected account |

5. Redeploy or wait for env vars to apply, then enable **Show TikTok** in the app

Check connection status: `GET /api/tiktok/status`

**Note:** TikTok access tokens expire after ~24 hours. Store `TIKTOK_REFRESH_TOKEN` so metrics keep working without repeating OAuth.

### 4. Daily follower snapshots (Cloudflare KV + GitHub Actions)

TikTok's API only returns the *current* follower count — there's no historical endpoint. Daily
history is recorded by a protected endpoint (`POST /api/tiktok/snapshot`) that fetches today's
count and appends it to a Cloudflare KV namespace. A scheduled GitHub Actions workflow
(`.github/workflows/tiktok-follower-snapshot.yml`) calls that endpoint once a day, since Cloudflare
Pages Functions have no native Cron Trigger (that's a Workers-only feature).

**Create and bind the KV namespace (Cloudflare dashboard):**

1. **Storage & Databases → KV** → **Create namespace** → name it something like
   `tiktok-followers` → Create
2. Go to your Pages project → **Settings → Functions → KV namespace bindings** → **Add binding**
3. Variable name: `TIKTOK_FOLLOWERS_KV` (must match exactly — this is the binding name the code
   looks up)
4. Namespace: the one you just created
5. Save — this applies on the next deploy (Retry deployment if needed)

**Set the shared secret (Cloudflare dashboard):**

Under **Pages → Settings → Variables and Secrets** (Production), add:

| Variable | Description |
|----------|--------------|
| `TIKTOK_SNAPSHOT_SECRET` | Random string (e.g. `openssl rand -hex 32`). Required in the `X-Snapshot-Secret` header to call `/api/tiktok/snapshot`. |

**Set the same secret in GitHub:**

Repo → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `TIKTOK_SNAPSHOT_SECRET`
- Value: the exact same string you put in Cloudflare

**Seed the KV namespace with existing history (one-time, via Wrangler CLI):**

The old `public/tiktok-followers.json` backfill (2026-06-01 through 2026-06-24) would otherwise be
lost once KV takes over as the source of truth. Push it into KV once:

```bash
npx wrangler kv key put --remote --namespace-id=<your-namespace-id> "history" \
  --path=public/tiktok-followers.json
```

(Find `<your-namespace-id>` on the KV namespace's page in the dashboard, or via
`npx wrangler kv namespace list`.)

**Verify:**

- `GET /api/tiktok/status` should show `hasFollowersKv: true` and `hasSnapshotSecret: true`
- Manually trigger the workflow once from **Actions → TikTok follower snapshot → Run workflow**
  and confirm it returns `"ok": true`
- After that, it runs daily at 06:10 UTC (`workflow_dispatch` is also enabled for on-demand runs)

Dates before the earliest recorded entry (i.e. before 2026-06-01, until you have more history) are
shown as 0 followers rather than being backfilled with today's live count.

## Project structure

```
branded-search-explorer/
├── functions/          # Cloudflare Pages Functions (API)
│   ├── api/auth/       # OAuth flow
│   ├── api/gsc/        # Search Console proxy
│   └── api/tiktok/     # TikTok OAuth + metrics
├── src/                # React + Tailwind + Chart.js
├── dist/               # Build output (deploy this + functions/)
└── .env.example
```
