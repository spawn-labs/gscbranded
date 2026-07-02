export interface Env {
  TIKTOK_ACCESS_TOKEN?: string;
  TIKTOK_REFRESH_TOKEN?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_OPEN_ID?: string;
  TIKTOK_HISTORY_KV: KVNamespace;
}

interface FollowerHistoryEntry {
  date: string;
  follower_count: number;
}

interface FollowerHistoryPayload {
  user_id?: string;
  data: FollowerHistoryEntry[];
}

const OAUTH_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,follower_count";

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return { res, payload: text ? JSON.parse(text) : {} };
  } catch {
    throw new Error(`Expected JSON from ${url}: ${text}`);
  }
}

async function refreshAccessToken(env: Env) {
  if (!env.TIKTOK_REFRESH_TOKEN || !env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    throw new Error("TikTok refresh token or client credentials are missing.");
  }

  const { res, payload } = await fetchJson(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: env.TIKTOK_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(payload)}`);
  }

  const accessToken = payload.access_token;
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("No access token returned by TikTok refresh.");
  }

  return accessToken;
}

async function getAccessToken(env: Env) {
  if (env.TIKTOK_ACCESS_TOKEN) return env.TIKTOK_ACCESS_TOKEN;
  return refreshAccessToken(env);
}

async function fetchUserInfo(accessToken: string) {
  const { res, payload } = await fetchJson(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`User info request failed: ${JSON.stringify(payload)}`);
  }

  const user = payload?.data?.user ?? payload?.data ?? {};
  return {
    open_id: typeof user.open_id === "string" ? user.open_id : undefined,
    follower_count: asNumber(user.follower_count),
  };
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const accessToken = await getAccessToken(env);
    const user = await fetchUserInfo(accessToken);
    const openId = env.TIKTOK_OPEN_ID ?? user.open_id;
    if (!openId) {
      throw new Error("TikTok open_id is not available.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const existing = await env.TIKTOK_HISTORY_KV.get("history", { type: "json" });
    const payload = (existing as FollowerHistoryPayload | null) ?? { user_id: openId, data: [] };
    const entries = Array.isArray(payload?.data) ? payload.data : [];
    const nextEntries = entries.filter((entry) => entry.date !== today);
    nextEntries.push({ date: today, follower_count: user.follower_count });
    nextEntries.sort((a, b) => a.date.localeCompare(b.date));

    await env.TIKTOK_HISTORY_KV.put("history", JSON.stringify({ user_id: openId, data: nextEntries }));
    console.log(`Updated TikTok follower history for ${openId} on ${today}`);
  },
};
