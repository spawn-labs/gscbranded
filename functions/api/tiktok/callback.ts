import { exchangeCode } from "../../lib/tiktok";

function getRedirectUri(env: Env, requestUrl: string): string {
  if (env.TIKTOK_OAUTH_REDIRECT_URI) {
    return env.TIKTOK_OAUTH_REDIRECT_URI;
  }
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}/api/tiktok/callback`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.json({ error: `TikTok authorization failed: ${error}` }, { status: 400 });
  }

  const cookies = context.request.headers.get("Cookie") ?? "";
  const stateMatch = cookies.match(/tiktok_oauth_state=([^;]+)/);
  const savedState = stateMatch?.[1];

  if (!code || !state || !savedState || state !== savedState) {
    return Response.json({ error: "Invalid or missing OAuth state/code" }, { status: 400 });
  }

  try {
    const redirectUri = getRedirectUri(context.env, context.request.url);
    const tokens = await exchangeCode(code, redirectUri, context.env);

    return Response.json(
      {
        access_token: tokens.access_token,
        open_id: tokens.open_id,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        message:
          "Copy these values into Cloudflare environment variables: TIKTOK_ACCESS_TOKEN (required) and TIKTOK_OPEN_ID (recommended).",
      },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "TikTok token exchange failed";
    return Response.json({ error: message }, { status: 502 });
  }
};
