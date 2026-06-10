import { formatIsoDate, shiftDays } from "./dates";

const OAUTH_AUTHORIZE_URL = "https://business-api.tiktok.com/open_api/v1.2/oauth2/authorize/";
const OAUTH_TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.2/oauth2/access_token/";
const API_BASE_URL = "https://open.tiktokapis.com/v1.2";

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
  data?: Record<string, unknown>;
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
    const date = new Date(raw * 1000);
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

function buildMetricsPoint(date: string, followers: number): TikTokPoint {
  return { date, followers, views: 0, likes: 0, engagement: 0 };
}

function normalizeVideoItem(item: any): {
  date: string | null;
  views: number;
  likes: number;
  shares: number;
  comments: number;
} {
  const date = parseDate(item.create_time ?? item.publish_time ?? item.c_time ?? item.publishTime);
  const views = asNumber(
    item.stats?.play_count ?? item.stats?.view_count ?? item.play_count ?? item.view_count ?? item.video_play_count,
  );
  const likes = asNumber(item.stats?.digg_count ?? item.stats?.like_count ?? item.likes ?? item.diggCount);
  const shares = asNumber(item.stats?.share_count ?? item.stats?.shareCount ?? item.shares);
  const comments = asNumber(item.stats?.comment_count ?? item.stats?.commentCount ?? item.comments);

  return { date, views, likes, shares, comments };
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
    const errorBody = parsed?.error || parsed?.message || JSON.stringify(parsed);
    throw new Error(`TikTok API error ${res.status}: ${errorBody}`);
  }
  return parsed;
}

export function tiktokAuthUrl(env: Env, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "user.info.basic video.list video.data",
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params}`;
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
      code,
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TikTok token exchange failed: ${text}`);
  }

  const payload = JSON.parse(text);
  const data = payload.data ?? payload;
  return {
    access_token: String(data.access_token ?? data.open_access_token ?? ""),
    refresh_token: String(data.refresh_token ?? ""),
    expires_in: asNumber(data.expires_in ?? data.expires),
    open_id: String(data.open_id ?? data.openid ?? data.openId ?? ""),
    data,
  };
}

export async function fetchTikTokUserInfo(accessToken: string): Promise<{ open_id?: string; follower_count: number }> {
  const url = `${API_BASE_URL}/user/info/?access_token=${encodeURIComponent(accessToken)}`;
  const payload = await fetchTikTokJson(url, accessToken, "GET");
  const data = payload.data ?? payload;
  return {
    open_id: String(data.open_id ?? data.openid ?? data.openId ?? ""),
    follower_count: asNumber(data.follower_count ?? data.followerCount ?? data.fans_count ?? data.followerCount),
  };
}

export async function fetchTikTokVideos(
  accessToken: string,
  openId?: string,
): Promise<any[]> {
  const videos: any[] = [];
  let cursor = 0;
  while (true) {
    const params = new URLSearchParams({
      open_id: openId ?? "",
      cursor: String(cursor),
      count: "50",
    });
    const url = `${API_BASE_URL}/video/list/?${params}`;
    const payload = await fetchTikTokJson(url, accessToken, "GET");
    const data = payload.data ?? payload;
    const batch =
      data.video_list ?? data.video_list_data ?? data.list ?? data.videos ?? data.video_list ?? [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    videos.push(...batch);
    const nextCursor = asNumber(data.cursor ?? data.next_cursor ?? data.nextCursor ?? 0);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
    if (videos.length >= 250) break;
  }
  return videos;
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
    throw new Error("TikTok account ID is not available. Set TIKTOK_OPEN_ID or ensure the token returns an open_id.");
  }

  const followerCount = userInfo.follower_count;
  const videoItems = await fetchTikTokVideos(accessToken, openId);

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
