import {
  DEFAULT_BUSINESS_UNIT_KEYWORDS,
  type BusinessUnitKeywords,
} from "../config/business-units";

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTerms(terms: string[]): string[] {
  const out = new Set<string>();
  for (const raw of terms) {
    const value = raw.trim();
    if (value) out.add(value);
  }
  return Array.from(out);
}

export function getBusinessUnitKeywordMap(env: Env): BusinessUnitKeywords {
  const map: BusinessUnitKeywords = {
    ...DEFAULT_BUSINESS_UNIT_KEYWORDS,
  };

  if (env.BUSINESS_UNIT_KEYWORDS_JSON) {
    try {
      const parsed = JSON.parse(env.BUSINESS_UNIT_KEYWORDS_JSON) as Record<string, unknown>;
      for (const [unit, values] of Object.entries(parsed)) {
        if (!Array.isArray(values)) continue;
        map[unit] = normalizeTerms(values.filter((v): v is string => typeof v === "string"));
      }
    } catch {
      // If JSON is invalid, fall through to defaults/legacy value.
    }
  }

  if (env.BRANDED_KEYWORDS && (!map.all || map.all.length === 0)) {
    map.all = normalizeTerms(env.BRANDED_KEYWORDS.split(","));
  }

  return map;
}

export function getKeywordsForBusinessUnit(env: Env, businessUnit: string): string[] {
  const map = getBusinessUnitKeywordMap(env);
  if (businessUnit in map) {
    return map[businessUnit] ?? [];
  }
  if (map.all && map.all.length > 0) {
    return map.all;
  }
  const first = Object.keys(map)[0];
  return first ? map[first] ?? [] : [];
}

export function listBusinessUnits(env: Env): string[] {
  const map = getBusinessUnitKeywordMap(env);
  return Object.keys(map);
}

function buildRegexChunks(terms: string[], maxRegexLength = 3500): string[] {
  const escaped = normalizeTerms(terms).map(escapeRegex);
  if (escaped.length === 0) {
    return [".*"];
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 2; // ()

  for (const term of escaped) {
    const nextLen = currentLength + term.length + (current.length > 0 ? 1 : 0);
    if (nextLen > maxRegexLength && current.length > 0) {
      chunks.push(`(${current.join("|")})`);
      current = [term];
      currentLength = term.length + 2;
      continue;
    }
    current.push(term);
    currentLength = nextLen;
  }

  if (current.length > 0) {
    chunks.push(`(${current.join("|")})`);
  }
  return chunks;
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
  keywords: string[],
): Promise<Record<string, number>> {
  const siteUrl = encodeURIComponent(env.GSC_SITE_URL);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`;
  const regexChunks = buildRegexChunks(keywords);
  const byDateQuery = new Map<string, number>();

  for (const expression of regexChunks) {
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
                expression,
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
    for (const row of data.rows ?? []) {
      const date = row.keys?.[0];
      const query = row.keys?.[1];
      if (!date || !query) continue;
      const key = `${date}__${query.toLowerCase()}`;
      // Avoid double-counting rows that match multiple regex chunks.
      if (!byDateQuery.has(key)) {
        byDateQuery.set(key, row.clicks ?? 0);
      }
    }
  }

  const byDate: Record<string, number> = {};
  for (const [key, clicks] of byDateQuery) {
    const date = key.split("__")[0];
    byDate[date] = (byDate[date] ?? 0) + clicks;
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
