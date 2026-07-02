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
| `TIKTOK_FOLLOWER_HISTORY_URL` | Optional path or URL for the daily follower history JSON (default: `/tiktok-followers.json`) |

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

### 4. Daily follower history refresh with KV

1. Create a KV namespace in Cloudflare:
   - Workers & Pages → KV → Create namespace
   - Example name: `gscbranded-tiktok-history`
2. Copy the namespace ID into [gscbranded/wrangler.jsonc](gscbranded/wrangler.jsonc).
3. Deploy the Worker:
   - `npx wrangler deploy --config wrangler.jsonc`
4. Add the same TikTok env vars to the Worker (not just Pages):
   - `TIKTOK_ACCESS_TOKEN` or `TIKTOK_REFRESH_TOKEN`
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - `TIKTOK_OPEN_ID`
5. Trigger the refresh once manually:
   - `npx wrangler invoke --config wrangler.jsonc --remote`
6. The app will read from KV first, and fall back to [gscbranded/public/tiktok-followers.json](gscbranded/public/tiktok-followers.json) if KV is unavailable.

**Note:** TikTok access tokens expire after ~24 hours. Store `TIKTOK_REFRESH_TOKEN` so metrics keep working without repeating OAuth.

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
