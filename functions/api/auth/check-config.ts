/** Diagnostic only — shows which env vars are set (not their values). */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  return Response.json({
    GOOGLE_CLIENT_ID: !!env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!env.GOOGLE_CLIENT_SECRET,
    OAUTH_REDIRECT_URI: !!env.OAUTH_REDIRECT_URI,
    GSC_SITE_URL: !!env.GSC_SITE_URL,
    BRANDED_KEYWORDS: !!env.BRANDED_KEYWORDS,
    SESSION_SECRET: !!env.SESSION_SECRET,
    TIKTOK_CLIENT_KEY: !!env.TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET: !!env.TIKTOK_CLIENT_SECRET,
    TIKTOK_OAUTH_REDIRECT_URI: !!env.TIKTOK_OAUTH_REDIRECT_URI,
    TIKTOK_ACCESS_TOKEN: !!env.TIKTOK_ACCESS_TOKEN,
    TIKTOK_REFRESH_TOKEN: !!env.TIKTOK_REFRESH_TOKEN,
    TIKTOK_OPEN_ID: !!env.TIKTOK_OPEN_ID,
  });
};
