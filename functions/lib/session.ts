const COOKIE_NAME = "bse_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function cookieFlags(request?: Request): string {
  const host = request ? new URL(request.url).hostname : "";
  const local = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  return local ? "Path=/; HttpOnly; SameSite=Lax" : "Path=/; HttpOnly; Secure; SameSite=Lax";
}

export interface SessionPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

function getSecret(env: Env): string {
  return env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET;
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function verify(data: string, signature: string, secret: string): Promise<boolean> {
  const expected = await sign(data, secret);
  return expected === signature;
}

export async function setSessionCookie(
  payload: SessionPayload,
  env: Env,
  request?: Request,
): Promise<string> {
  const body = btoa(JSON.stringify(payload));
  const sig = await sign(body, getSecret(env));
  const value = `${body}.${sig}`;
  return `${COOKIE_NAME}=${value}; ${cookieFlags(request)}; Max-Age=${MAX_AGE}`;
}

export async function getSession(
  request: Request,
  env: Env,
): Promise<SessionPayload | null> {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const [body, sig] = match[1].split(".");
  if (!body || !sig) return null;

  const valid = await verify(body, sig, getSecret(env));
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(body)) as SessionPayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearSessionCookie(request?: Request): string {
  return `${COOKIE_NAME}=; ${cookieFlags(request)}; Max-Age=0`;
}
