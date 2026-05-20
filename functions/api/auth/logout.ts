import { clearSessionCookie } from "../../lib/session";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return Response.json(
    { ok: true },
    {
      headers: { "Set-Cookie": clearSessionCookie(context.request) },
    },
  );
};
