import { resolveAccessToken, fetchTikTokUserInfo } from "../../lib/tiktok";

interface FollowerHistoryEntry {
  date: string;
  follower_count: number;
}

interface FollowerHistoryPayload {
  user_id?: string;
  data: FollowerHistoryEntry[];
}

function normalizeEntries(entries: unknown): FollowerHistoryEntry[] {
  if (!Array.isArray(entries)) return [];

  return entries.filter(
    (entry): entry is FollowerHistoryEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { date?: unknown }).date === "string" &&
      typeof (entry as { follower_count?: unknown }).follower_count === "number",
  );
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.TIKTOK_HISTORY_KV;

  if (kv) {
    const stored = await kv.get("history", { type: "json" });
    if (stored) {
      const payload = stored as FollowerHistoryPayload;
      const data = normalizeEntries(payload?.data ?? []);
      return Response.json({
        user_id: payload?.user_id,
        data,
      });
    }
  }

  const fallbackUrl = new URL("/tiktok-followers.json", context.request.url);
  const fallbackRes = await fetch(fallbackUrl);
  if (fallbackRes.ok) {
    return fallbackRes;
  }

  return Response.json(
    { error: "No follower history is available yet. Trigger a refresh first." },
    { status: 404 },
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const kv = context.env.TIKTOK_HISTORY_KV;
  if (!kv) {
    return Response.json(
      { error: "TIKTOK_HISTORY_KV is not configured for this Pages project." },
      { status: 500 },
    );
  }

  const accessToken = await resolveAccessToken(context.env);
  const user = await fetchTikTokUserInfo(accessToken);
  const openId = context.env.TIKTOK_OPEN_ID ?? user.open_id;
  if (!openId) {
    return Response.json({ error: "TikTok open_id is not available." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = await kv.get("history", { type: "json" });
  const payload = (existing as FollowerHistoryPayload | null) ?? { user_id: openId, data: [] };
  const entries = normalizeEntries(payload.data ?? []);
  const nextEntries = entries.filter((entry) => entry.date !== today);
  nextEntries.push({ date: today, follower_count: user.follower_count });
  nextEntries.sort((a, b) => a.date.localeCompare(b.date));

  const nextPayload: FollowerHistoryPayload = {
    user_id: openId,
    data: nextEntries,
  };

  await kv.put("history", JSON.stringify(nextPayload));

  return Response.json(nextPayload);
};
