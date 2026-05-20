import { exchangeCode } from "../../lib/google";
import { setSessionCookie } from "../../lib/session";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(`/?auth_error=${encodeURIComponent(error)}`, 302);
  }

  const cookies = context.request.headers.get("Cookie") ?? "";
  const stateMatch = cookies.match(/oauth_state=([^;]+)/);
  const savedState = stateMatch?.[1];

  if (!code || !state || !savedState || state !== savedState) {
    return Response.redirect("/?auth_error=invalid_state", 302);
  }

  try {
    const tokens = await exchangeCode(code, context.env);
    const cookie = await setSessionCookie(
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      },
      context.env,
      context.request,
    );
    const headers = new Headers();
    headers.append("Set-Cookie", cookie);
    const host = new URL(context.request.url).hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    const secure = local ? "" : " Secure;";
    headers.append(
      "Set-Cookie",
      `oauth_state=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`,
    );
    headers.set("Location", "/");
    return new Response(null, { status: 302, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth_failed";
    return Response.redirect(`/?auth_error=${encodeURIComponent(msg)}`, 302);
  }
};
