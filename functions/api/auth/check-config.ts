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
  });
};
