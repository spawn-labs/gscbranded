const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export function googleAuthUrl(env: Env, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCode(
  code: string,
  env: Env,
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
  env: Env,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json();
}

export function brandedKeywordRegex(keywords: string): string {
  const terms = keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return ".*";
  return `(${terms.join("|")})`;
}

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
}

export async function fetchBrandedSearchByDate(
  accessToken: string,
  env: Env,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const siteUrl = encodeURIComponent(env.GSC_SITE_URL);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["date", "query"],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: "query",
              operator: "includingRegex",
              expression: brandedKeywordRegex(env.BRANDED_KEYWORDS),
            },
          ],
        },
      ],
      rowLimit: 25000,
    }),
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMIT");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC API error (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { rows?: GscRow[] };
  const byDate: Record<string, number> = {};

  for (const row of data.rows ?? []) {
    const date = row.keys?.[0];
    if (!date) continue;
    byDate[date] = (byDate[date] ?? 0) + (row.clicks ?? 0);
  }

  return byDate;
}

export async function getValidAccessToken(
  session: { accessToken: string; refreshToken?: string; expiresAt: number },
  env: Env,
): Promise<string> {
  if (session.expiresAt > Date.now() + 60_000) {
    return session.accessToken;
  }
  if (!session.refreshToken) {
    throw new Error("SESSION_EXPIRED");
  }
  const tokens = await refreshAccessToken(session.refreshToken, env);
  return tokens.access_token;
}
