import { seriesFromMap, shiftDays } from "../../lib/dates";
import { fetchTikTokSeries } from "../../lib/tiktok";

/** TikTok metrics — returns demo data until TIKTOK_ACCESS_TOKEN is configured. */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return Response.json({ error: "start and end dates required (YYYY-MM-DD)" }, { status: 400 });
  }

  const accessToken = context.env.TIKTOK_ACCESS_TOKEN;
  if (accessToken) {
    const analyticsEndpoint = context.env.TIKTOK_ANALYTICS_ENDPOINT;
    if (analyticsEndpoint) {
      const params = new URLSearchParams({ start, end });
      const proxyUrl = analyticsEndpoint.includes("?")
        ? `${analyticsEndpoint}&${params}`
        : `${analyticsEndpoint}?${params}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!proxyRes.ok) {
        const bodyText = await proxyRes.text();
        return Response.json(
          { error: `TikTok analytics endpoint returned ${proxyRes.status}: ${bodyText}` },
          { status: 502 },
        );
      }

      const payload = await proxyRes.json();
      return Response.json(payload);
    }

    try {
      const series = await fetchTikTokSeries(accessToken, context.env, start, end);
      return Response.json({
        source: "tiktok",
        configured: true,
        message: "Live TikTok metrics from TikTok Business API.",
        series,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return Response.json({ error: message }, { status: 502 });
    }
  }

  // Deterministic demo series so overlay UI can be tested without credentials
  const seed = start.split("-").join("");
  const map: Record<string, { followers: number; views: number; likes: number; engagement: number }> = {};
  let cur = start;
  let i = 0;
  while (cur <= end) {
    const n = (parseInt(seed, 10) + i * 17) % 100;
    map[cur] = {
      followers: 12000 + i * 12 + (n % 30),
      views: 800 + (n % 50) * 40,
      likes: 120 + (n % 25) * 8,
      engagement: 45 + (n % 20) * 3,
    };
    cur = shiftDays(cur, 1);
    i++;
  }

  const empty = { followers: 0, views: 0, likes: 0, engagement: 0 };
  const dates = seriesFromMap(
    Object.fromEntries(Object.keys(map).map((d) => [d, 0])),
    start,
    end,
  ).map((r) => r.date);

  const series = dates.map((date) => ({
    date,
    ...(map[date] ?? empty),
  }));

  return Response.json({
    source: "demo",
    configured: false,
    message: "Showing sample TikTok data. Add TIKTOK_ACCESS_TOKEN to enable live metrics.",
    series,
  });
};
