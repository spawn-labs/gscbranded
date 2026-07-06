import { formatIsoDate } from "../../lib/dates";
import { fetchCurrentFollowerCountWithRefresh, recordFollowerSnapshot } from "../../lib/tiktok";

/**
 * Records today's live TikTok follower count into KV. Called once a day by an external
 * scheduler (GitHub Actions) since Cloudflare Pages Functions have no native Cron Trigger.
 * Protected by a shared secret — not meant to be publicly reachable.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.TIKTOK_SNAPSHOT_SECRET) {
    return Response.json({ error: "TIKTOK_SNAPSHOT_SECRET is not configured." }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-snapshot-secret");
  if (providedSecret !== env.TIKTOK_SNAPSHOT_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.TIKTOK_FOLLOWERS_KV) {
    return Response.json(
      { error: "TIKTOK_FOLLOWERS_KV binding is not configured for this Pages project." },
      { status: 500 },
    );
  }

  try {
    const { openId, followerCount, refreshed } = await fetchCurrentFollowerCountWithRefresh(env);
    const today = formatIsoDate(new Date());
    const history = await recordFollowerSnapshot(env.TIKTOK_FOLLOWERS_KV, openId, today, followerCount);

    return Response.json({
      ok: true,
      date: today,
      follower_count: followerCount,
      entries: history.length,
      tokenRefresh: refreshed
        ? {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_in: refreshed.expires_in,
          }
        : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
};
