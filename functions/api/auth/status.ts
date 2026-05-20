import { getSession } from "../../lib/session";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await getSession(context.request, context.env);
  return Response.json({ authenticated: !!session });
};
