import { formatIsoDate, shiftDays } from "./dates";

const OAUTH_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const OAUTH_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const API_BASE_URL = "https://open.tiktokapis.com/v2";

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
] as const;

export interface TikTokPoint {
  date: string;
  followers: number;
  views: number;
  likes: number;
  engagement: number;
}

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
}

interface TikTokApiError {
  code?: string;
  message?: string;
  log_id?: string;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "number") {
    const ms = raw > 1_000_000_000_000 ? raw : raw * 1000;
    const date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return null;
    return formatIsoDate(date);
  }
  if (typeof raw === "string") {
    const normalized = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
    const parsed = new Date(normalized);
    if (!Number.isFinite(parsed.getTime())) return null;
    return formatIsoDate(parsed);
  }
  return null;
}

function assertTikTokOk(payload: { error?: TikTokApiError }, context: string): void {
  const code = payload.error?.code;
  if (code && code !== "ok") {
    const message = payload.error?.message || code;
    throw new Error(`TikTok API error (${context}): ${message}`);
  }
}

async function fetchTikTokJson(
  url: string,
  accessToken: string,
  method = "GET",
  body?: Record<string, unknown>,
): Promise<any> {
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const init: RequestInit = { method, headers };
  if (body) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`TikTok API did not return JSON (${res.status}): ${text}`);
  }

  if (!res.ok) {
    const errorBody = parsed?.error?.message || parsed?.error || parsed?.message || text;
    throw new Error(`TikTok API HTTP ${res.status}: ${errorBody}`);
  }

  assertTikTokOk(parsed, url);
  return parsed;
}

export function tiktokRedirectUri(env: Env, requestUrl: string): string {
  if (env.TIKTOK_OAUTH_REDIRECT_URI) {
    return env.TIKTOK_OAUTH_REDIRECT_URI;
  }
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}/api/tiktok/callback`;
}

export function tiktokAuthUrl(env: Env, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: TIKTOK_SCOPES.join(","),
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

function parseTokenResponse(payload: Record<string, unknown>): TikTokTokenResponse {
  return {
    access_token: String(payload.access_token ?? ""),
    refresh_token: payload.refresh_token ? String(payload.refresh_token) : undefined,
    expires_in: asNumber(payload.expires_in),
    open_id: payload.open_id ? String(payload.open_id) : undefined,
    scope: payload.scope ? String(payload.scope) : undefined,
    token_type: payload.token_type ? String(payload.token_type) : undefined,
  };
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  env: Env,
): Promise<TikTokTokenResponse> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: env.TIKTOK_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const text = await res.text();
  let payload: Record<string, unknown>;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`TikTok token exchange failed (${res.status}): ${text}`);
  }

  if (!res.ok) {
    const message =
      (payload.error_description as string | undefined) ||
      (payload.error as string | undefined) ||
      text;
    throw new Error(`TikTok token exchange failed: ${message}`);
  }

  const tokens = parseTokenResponse(payload);
  if (!tokens.access_token) {
    throw new Error("TikTok token exchange succeeded but no access_token was returned.");
  }
  return tokens;
}

export async function refreshAccessToken(env: Env): Promise<TikTokTokenResponse> {
  const refreshToken = env.TIKTOK_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("TIKTOK_REFRESH_TOKEN is not configured.");
  }

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY ?? "",
      client_secret: env.TIKTOK_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const text = await res.text();
  let payload: Record<string, unknown>;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`TikTok token refresh failed (${res.status}): ${text}`);
  }

  if (!res.ok) {
    const message =
      (payload.error_description as string | undefined) ||
      (payload.error as string | undefined) ||
      text;
    throw new Error(`TikTok token refresh failed: ${message}`);
  }

  const tokens = parseTokenResponse(payload);
  if (!tokens.access_token) {
    throw new Error("TikTok token refresh succeeded but no access_token was returned.");
  }
  return tokens;
}

export async function resolveAccessToken(env: Env): Promise<string> {
  if (env.TIKTOK_ACCESS_TOKEN) {
    return env.TIKTOK_ACCESS_TOKEN;
  }
  const refreshed = await refreshAccessToken(env);
  return refreshed.access_token;
}

export function tiktokConfigured(env: Env): {
  oauthReady: boolean;
  metricsReady: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!env.TIKTOK_CLIENT_KEY) missing.push("TIKTOK_CLIENT_KEY");
  if (!env.TIKTOK_CLIENT_SECRET) missing.push("TIKTOK_CLIENT_SECRET");
  if (!env.TIKTOK_OAUTH_REDIRECT_URI) missing.push("TIKTOK_OAUTH_REDIRECT_URI");

  const oauthReady = !!env.TIKTOK_CLIENT_KEY && !!env.TIKTOK_CLIENT_SECRET;
  const metricsReady =
    !!env.TIKTOK_ACCESS_TOKEN || (!!env.TIKTOK_REFRESH_TOKEN && oauthReady);

  return { oauthReady, metricsReady, missing };
}

export async function fetchTikTokUserInfo(
  accessToken: string,
): Promise<{ open_id?: string; follower_count: number; display_name?: string; username?: string }> {
  const fields = [
    "open_id",
    "display_name",
    "username",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
  ].join(",");
  const url = `${API_BASE_URL}/user/info/?fields=${encodeURIComponent(fields)}`;
  const payload = await fetchTikTokJson(url, accessToken, "GET");
  const user = payload.data?.user ?? payload.data ?? {};
  return {
    open_id: user.open_id ? String(user.open_id) : undefined,
    display_name: user.display_name ? String(user.display_name) : undefined,
    username: user.username ? String(user.username) : undefined,
    follower_count: asNumber(user.follower_count),
  };
}

export async function fetchTikTokVideos(accessToken: string): Promise<any[]> {
  const fields = [
    "id",
    "create_time",
    "view_count",
    "like_count",
    "comment_count",
    "share_count",
  ].join(",");
  const videos: any[] = [];
  let cursor: number | undefined;

  while (true) {
    const url = `${API_BASE_URL}/video/list/?fields=${encodeURIComponent(fields)}`;
    const body: Record<string, unknown> = { max_count: 20 };
    if (cursor !== undefined) body.cursor = cursor;

    const payload = await fetchTikTokJson(url, accessToken, "POST", body);
    const data = payload.data ?? {};
    const batch = data.videos ?? [];
    if (!Array.isArray(batch) || batch.length === 0) break;

    videos.push(...batch);
    if (!data.has_more) break;

    const nextCursor = asNumber(data.cursor);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
    if (videos.length >= 250) break;
  }

  return videos;
}

function normalizeVideoItem(item: any): {
  date: string | null;
  views: number;
  likes: number;
  shares: number;
  comments: number;
} {
  const date = parseDate(item.create_time ?? item.publish_time ?? item.c_time ?? item.publishTime);
  const views = asNumber(item.view_count ?? item.stats?.play_count ?? item.stats?.view_count);
  const likes = asNumber(item.like_count ?? item.stats?.digg_count ?? item.stats?.like_count);
  const shares = asNumber(item.share_count ?? item.stats?.share_count);
  const comments = asNumber(item.comment_count ?? item.stats?.comment_count);

  return { date, views, likes, shares, comments };
}

export async function fetchTikTokSeries(
  accessToken: string,
  env: Env,
  start: string,
  end: string,
): Promise<TikTokPoint[]> {
  const userInfo = await fetchTikTokUserInfo(accessToken);
  const openId = env.TIKTOK_OPEN_ID ?? userInfo.open_id;
  if (!openId) {
    throw new Error(
      "TikTok account ID is not available. Set TIKTOK_OPEN_ID or ensure the token returns an open_id.",
    );
  }

  const followerCount = userInfo.follower_count;
  const videoItems = await fetchTikTokVideos(accessToken);

  const map: Record<string, { views: number; likes: number; interactions: number }> = {};
  let curDate = start;
  while (curDate <= end) {
    map[curDate] = { views: 0, likes: 0, interactions: 0 };
    curDate = shiftDays(curDate, 1);
  }

  for (const item of videoItems) {
    const parsed = normalizeVideoItem(item);
    if (!parsed.date || parsed.date < start || parsed.date > end) continue;
    const entry = map[parsed.date] ?? { views: 0, likes: 0, interactions: 0 };
    entry.views += parsed.views;
    entry.likes += parsed.likes;
    entry.interactions += parsed.likes + parsed.comments + parsed.shares;
    map[parsed.date] = entry;
  }

  return Object.keys(map)
    .sort()
    .map((date) => {
      const entry = map[date];
      const engagement = entry.views > 0 ? Math.round((entry.interactions / entry.views) * 100) : 0;
      return {
        date,
        followers: followerCount,
        views: entry.views,
        likes: entry.likes,
        engagement,
      };
    });
}

export async function fetchTikTokSeriesWithRefresh(
  env: Env,
  start: string,
  end: string,
): Promise<{ series: TikTokPoint[]; refreshed?: TikTokTokenResponse }> {
  let accessToken = await resolveAccessToken(env);

  try {
    return { series: await fetchTikTokSeries(accessToken, env, start, end) };
  } catch (firstError) {
    if (!env.TIKTOK_REFRESH_TOKEN) {
      throw firstError;
    }

    const refreshed = await refreshAccessToken(env);
    accessToken = refreshed.access_token;
    const series = await fetchTikTokSeries(accessToken, env, start, end);
    return { series, refreshed };
  }
}
