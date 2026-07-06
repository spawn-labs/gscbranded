import { tiktokConfigured } from "../../lib/tiktok";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { oauthReady, metricsReady, missing } = tiktokConfigured(context.env);

  return Response.json({
    oauthReady,
    metricsReady,
    hasAccessToken: !!context.env.TIKTOK_ACCESS_TOKEN,
    hasRefreshToken: !!context.env.TIKTOK_REFRESH_TOKEN,
    hasOpenId: !!context.env.TIKTOK_OPEN_ID,
    redirectUri: context.env.TIKTOK_OAUTH_REDIRECT_URI ?? null,
    hasFollowersKv: !!context.env.TIKTOK_FOLLOWERS_KV,
    hasSnapshotSecret: !!context.env.TIKTOK_SNAPSHOT_SECRET,
    missing,
    connectUrl: oauthReady ? "/api/tiktok/oauth" : null,
  });
};
