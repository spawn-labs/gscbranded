import { exchangeCode, tiktokRedirectUri } from "../../lib/tiktok";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return Response.json(
      {
        error: `TikTok authorization failed: ${error}`,
        error_description: errorDescription ?? undefined,
      },
      { status: 400 },
    );
  }

  const cookies = context.request.headers.get("Cookie") ?? "";
  const stateMatch = cookies.match(/tiktok_oauth_state=([^;]+)/);
  const savedState = stateMatch?.[1];

  if (!code || !state || !savedState || state !== savedState) {
    return Response.json({ error: "Invalid or missing OAuth state/code" }, { status: 400 });
  }

  try {
    const redirectUri = tiktokRedirectUri(context.env, context.request.url);
    const tokens = await exchangeCode(code, redirectUri, context.env);

    return Response.json(
      {
        access_token: tokens.access_token,
        open_id: tokens.open_id,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        redirect_uri: redirectUri,
        cloudflare_variables: {
          TIKTOK_ACCESS_TOKEN: tokens.access_token,
          TIKTOK_OPEN_ID: tokens.open_id,
          TIKTOK_REFRESH_TOKEN: tokens.refresh_token,
          TIKTOK_OAUTH_REDIRECT_URI: redirectUri,
        },
        message:
          "Copy cloudflare_variables into Cloudflare Pages → Settings → Variables and Secrets. TIKTOK_REFRESH_TOKEN lets the app renew the 24-hour access token automatically.",
      },
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "TikTok token exchange failed";
    return Response.json({ error: message }, { status: 502 });
  }
};
