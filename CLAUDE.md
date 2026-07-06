# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Cloudflare Pages app (React + Vite frontend, Pages Functions backend) that graphs branded search
clicks from Google Search Console, with period-over-period comparison and an optional TikTok metrics
overlay. All OAuth secrets and token exchange happen server-side in `functions/` — the browser never
sees client secrets or long-lived tokens.

## Commands

```bash
npm install

# Frontend-only hot reload (proxies /api to :8788 — run pages:dev alongside it)
npm run dev

# Full local stack including Functions (requires build first)
npm run build && npm run pages:dev

# Production build (type-checks first, then vite build)
npm run build

# Deploy to Cloudflare Pages
npm run pages:deploy
```

There is no test suite and no lint script configured. `npm run build` runs `tsc --noEmit -p
tsconfig.app.json` before `vite build` — that's the primary correctness check for frontend code.
Functions code (`functions/`) is type-checked implicitly via editor/tsc but is not part of the
`npm run build` command.

Local secrets go in `.dev.vars` (gitignored, copy from `.env.example`) — Wrangler reads this for
Functions during `pages:dev`. Vite dev server has no access to Functions directly, hence the proxy.

## Architecture

**Two separate runtimes in one repo:**
- `src/` — React 19 + Tailwind v4 + Chart.js SPA, built by Vite to `dist/`.
- `functions/` — Cloudflare Pages Functions (one file per route, file-based routing under
  `functions/api/...`). These run as Workers, not Node — no Node APIs, use Web APIs
  (`crypto.subtle`, `fetch`, etc).

**Auth/session flow:** Google OAuth is the only login; there's no app-level user system.
`functions/api/auth/google.ts` redirects to Google and sets an `oauth_state` cookie for CSRF
protection; `functions/api/auth/callback.ts` exchanges the code and calls
`functions/lib/session.ts` to set a signed, HttpOnly session cookie (`bse_session`) containing the
access/refresh token pair. `functions/lib/session.ts` signs with HMAC-SHA256 using
`SESSION_SECRET` (falls back to `GOOGLE_CLIENT_SECRET` if unset) — there's no encryption, just a
signature, so don't put anything in the session payload you wouldn't want readable if the cookie
leaked. Every GSC-backed endpoint calls `getValidAccessToken()` (`functions/lib/google.ts`), which
transparently refreshes and re-sets the cookie when the token is near expiry — API route handlers
don't need to think about refresh themselves.

**Business unit keywords:** Branded search matching is keyword-based, not query-based. Keywords are
grouped by "business unit" (e.g. `all`, `consumer`, `enterprise`) via
`BUSINESS_UNIT_KEYWORDS_JSON` (preferred) or the legacy comma-separated `BRANDED_KEYWORDS` (falls
back to populating the `all` unit only if JSON isn't set). `functions/config/business-units.ts`
holds `DEFAULT_BUSINESS_UNIT_KEYWORDS` as a code-level fallback for large keyword lists that
shouldn't live in an env var. `functions/lib/google.ts`'s `getBusinessUnitKeywordMap` merges
defaults + env JSON + legacy var, in that precedence. Keyword lists are compiled into chunked
regex alternations (`buildRegexChunks`, capped ~3500 chars per chunk) for the GSC API's
`includingRegex` query filter, since GSC has a query-length limit — this is why keyword matching is
split across multiple API calls that then get de-duped by `date__query` key before summing.

**Date range logic** lives in `functions/lib/dates.ts` (server) — `defaultRange()` lags 3 days
behind "today" because GSC data isn't available immediately. `priorYearRange`/`priorPeriodRange`
implement the two comparison modes the UI exposes. There's a parallel, simpler `src/lib/dates.ts`
for the frontend's own default-range display; don't confuse the two or assume they're the same
file.

**TikTok integration** (`functions/lib/tiktok.ts`) is independent of the Google OAuth flow and uses
its own client key/secret and token env vars, refreshed via `fetchTikTokSeriesWithRefresh` (tries
current `TIKTOK_ACCESS_TOKEN`, falls back to refreshing via `TIKTOK_REFRESH_TOKEN` on failure).
Follower counts aren't available per-day from TikTok's API, so daily follower history is
backfilled from a static JSON file (`public/tiktok-followers.json`, or a URL override via
`TIKTOK_FOLLOWER_HISTORY_URL`), forward-filled between known dates. Video-level metrics (views,
likes, engagement) come from `video.list` and are bucketed by day. This whole feature degrades
gracefully — with no TikTok env vars configured, `functions/api/tiktok/status.ts` reports
`oauthReady`/`metricsReady: false` and the frontend shows demo/placeholder state instead of erroring.

**Env typing:** `functions/env.d.ts` declares the `Env` interface consumed via
`PagesFunction<Env>` in every function file — when adding a new env var, add it there too or
Functions code referencing it won't type-check.

## Deployment gotcha

Do not commit a `wrangler.toml` unless it also defines the environment variables — if present,
Cloudflare treats it as the source of truth for config and dashboard-set Variables/Secrets may not
reach Functions, silently breaking OAuth (`check-config.ts` and the `hint` field in
`auth/google.ts`'s error response exist specifically to debug this failure mode).
