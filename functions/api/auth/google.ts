import { googleAuthUrl } from "../../lib/google";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  if (!env.GOOGLE_CLIENT_ID || !env.OAUTH_REDIRECT_URI) {
    return Response.json({ error: "OAuth is not configured" }, { status: 500 });
  }
  const state = crypto.randomUUID();
  const headers = new Headers();
  const host = new URL(context.request.url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  const secure = local ? "" : " Secure;";
  headers.set(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=600`,
  );
  headers.set("Location", googleAuthUrl(env, state));
  return new Response(null, { status: 302, headers });
};
