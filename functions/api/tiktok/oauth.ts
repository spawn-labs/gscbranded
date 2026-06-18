import { tiktokAuthUrl, tiktokRedirectUri } from "../../lib/tiktok";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    return Response.json(
      {
        error: "TikTok OAuth is not configured",
        missing: {
          TIKTOK_CLIENT_KEY: !env.TIKTOK_CLIENT_KEY,
          TIKTOK_CLIENT_SECRET: !env.TIKTOK_CLIENT_SECRET,
        },
        hint: "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Cloudflare environment variables.",
      },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = tiktokRedirectUri(env, context.request.url);
  const headers = new Headers();
  const host = new URL(context.request.url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  const secure = local ? "" : " Secure;";
  headers.set(
    "Set-Cookie",
    `tiktok_oauth_state=${state}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=600`,
  );
  headers.set("Location", tiktokAuthUrl(env, state, redirectUri));
  return new Response(null, { status: 302, headers });
};
