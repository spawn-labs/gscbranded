import {
  fetchBrandedSearchByDate,
  getValidAccessToken,
} from "../../lib/google";
import {
  defaultRange,
  priorPeriodRange,
  priorYearRange,
  seriesFromMap,
  totalClicks,
} from "../../lib/dates";
import { getSession, setSessionCookie } from "../../lib/session";

type CompareMode = "prior_year" | "prior_period";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await getSession(context.request, context.env);
  if (!session) {
    return Response.json({ error: "Not authenticated", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(context.request.url);
  const defaults = defaultRange();
  const start = url.searchParams.get("start") ?? defaults.start;
  const end = url.searchParams.get("end") ?? defaults.end;
  const compare = (url.searchParams.get("compare") ?? "prior_year") as CompareMode;

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(start) || !dateRe.test(end) || start > end) {
    return Response.json({ error: "Invalid date range" }, { status: 400 });
  }

  let compareStart: string;
  let compareEnd: string;
  if (compare === "prior_period") {
    ({ start: compareStart, end: compareEnd } = priorPeriodRange(start, end));
  } else {
    ({ start: compareStart, end: compareEnd } = priorYearRange(start, end));
  }

  try {
    let accessToken = await getValidAccessToken(session, context.env);
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const refreshed = session.expiresAt <= Date.now() + 60_000 && session.refreshToken;
    if (refreshed) {
      const cookie = await setSessionCookie(
        {
          ...session,
          accessToken,
          expiresAt: Date.now() + 3600 * 1000,
        },
        context.env,
        context.request,
      );
      headers["Set-Cookie"] = cookie;
    }

    const [currentMap, compareMap] = await Promise.all([
      fetchBrandedSearchByDate(accessToken, context.env, start, end),
      fetchBrandedSearchByDate(accessToken, context.env, compareStart, compareEnd),
    ]);

    const current = seriesFromMap(currentMap, start, end);
    const comparison = seriesFromMap(compareMap, compareStart, compareEnd);

    const currentTotal = totalClicks(current);
    const compareTotal = totalClicks(comparison);
    const delta = currentTotal - compareTotal;
    const deltaPct =
      compareTotal === 0 ? null : Math.round((delta / compareTotal) * 1000) / 10;

    return Response.json(
      {
        current: { start, end, series: current, total: currentTotal },
        comparison: {
          start: compareStart,
          end: compareEnd,
          series: comparison,
          total: compareTotal,
          mode: compare,
        },
        delta,
        deltaPct,
        siteUrl: context.env.GSC_SITE_URL,
      },
      { headers },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "RATE_LIMIT") {
      return Response.json(
        { error: "Google Search Console rate limit exceeded. Try again later.", code: "RATE_LIMIT" },
        { status: 429 },
      );
    }
    if (message === "SESSION_EXPIRED") {
      return Response.json({ error: "Session expired", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    return Response.json({ error: message }, { status: 502 });
  }
};
