# Branded Search Explorer

Graph and table view of **branded search clicks** from Google Search Console, with period comparisons and optional **TikTok metric overlays**. Built for **Cloudflare Pages** — API secrets never ship to the browser.

## Features

- Line chart of daily branded search clicks (queries matching your keyword list)
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
| `BRANDED_KEYWORDS` | Comma-separated terms matched against queries (regex OR) |
| `SESSION_SECRET` | Random string for signing session cookies |

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

1. Push this folder to a Git repo (or upload via dashboard)
2. **Build command:** `npm run build`
3. **Build output directory:** `dist`
4. Add the same environment variables as `.dev.vars` under **Settings → Environment variables**
5. Update `OAUTH_REDIRECT_URI` to your production URL
6. Add the production redirect URI in Google Cloud Console

Optional CLI:

```bash
npm run pages:deploy
```

## Security

- Client ID/secret and tokens are only used in **Cloudflare Functions** (`functions/`)
- Session stored in **HttpOnly** signed cookie (8-hour max age)
- No app user accounts — only Google OAuth for API access
- Do **not** commit `.dev.vars`, `.env`, or `client_secret*.json`

## TikTok (later)

Set `TIKTOK_ACCESS_TOKEN` in environment variables and extend `functions/api/tiktok/metrics.ts` with your TikTok Business/API calls. Until then, **Show TikTok** uses deterministic sample data so you can test the overlay UI.

## Project structure

```
branded-search-explorer/
├── functions/          # Cloudflare Pages Functions (API)
│   ├── api/auth/       # OAuth flow
│   ├── api/gsc/        # Search Console proxy
│   └── api/tiktok/     # TikTok metrics (stub/demo)
├── src/                # React + Tailwind + Chart.js
├── dist/               # Build output (deploy this + functions/)
└── wrangler.toml
```
