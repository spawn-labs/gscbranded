import type { BrandedSearchResponse, TikTokMetric, TikTokPoint } from "./api";

export interface CorrelationResult {
  /** Pearson r in [-1, 1], or null when it can't be computed (n < 2 or zero variance). */
  r: number | null;
  /** Number of aligned, non-missing date pairs the coefficient is based on. */
  n: number;
}

/**
 * Pearson correlation coefficient of two equal-length numeric arrays.
 * Returns null when there are fewer than 2 points, or when either series is flat
 * (zero variance), where correlation is mathematically undefined.
 */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return null;

  // Clamp to guard against floating-point drift just outside [-1, 1].
  return Math.max(-1, Math.min(1, cov / denom));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Days branded search is assumed to lag TikTok activity. Social exposure lifts
 * branded search over the following days ("social-to-search halo"); the documented
 * range is a few days to 2–4 weeks, so 7 is a defensible mid-band default. This is a
 * model of the average population-level delay, NOT a claim about any one person's
 * journey from awareness to search.
 *
 * NOTE (future): the more rigorous approach is a lag *sweep* — recompute r across a
 * range of lags (e.g. 0–14 days) and report the peak, i.e. lagged cross-correlation.
 * Deliberately not doing that here: sweeping and keeping the best-fitting lag risks
 * fitting the data to a theory on a small sample. A fixed, pre-committed lag keeps
 * this an honest forward-looking model rather than a retrofit.
 */
export const BRANDED_SEARCH_LAG_DAYS = 7;

/** Adds `days` to a YYYY-MM-DD date string (UTC math, avoids timezone drift). */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Aligns branded-search clicks with one TikTok metric by date, drops any day where
 * either value is missing or non-finite, then returns the Pearson correlation.
 *
 * With `lagDays > 0`, TikTok activity on date D is paired with branded clicks on
 * D + lagDays — i.e. search is assumed to follow social by that many days. Applies to
 * per-day metrics (views, likes, engagement); Followers is a cumulative, forward-filled
 * trend where a lag adds nothing, so callers pass lagDays = 0 for it. Shifting drops
 * ~lagDays pairs off the window, which the returned `n` reflects.
 */
export function correlateWithBranded(
  branded: BrandedSearchResponse | null,
  tiktokSeries: TikTokPoint[] | null,
  metric: TikTokMetric,
  lagDays = 0,
): CorrelationResult {
  if (!branded || !tiktokSeries || tiktokSeries.length === 0) {
    return { r: null, n: 0 };
  }

  const clicksByDate = new Map<string, number>();
  for (const point of branded.current.series) {
    if (isFiniteNumber(point.clicks)) {
      clicksByDate.set(point.date, point.clicks);
    }
  }

  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of tiktokSeries) {
    const clicksDate = lagDays ? addDays(point.date, lagDays) : point.date;
    const clicks = clicksByDate.get(clicksDate);
    const metricValue = point[metric];
    if (isFiniteNumber(clicks) && isFiniteNumber(metricValue)) {
      xs.push(clicks);
      ys.push(metricValue);
    }
  }

  return { r: pearson(xs, ys), n: xs.length };
}

export type CorrelationTone = "positive" | "negative" | "none";

export interface CorrelationLabel {
  text: string;
  tone: CorrelationTone;
}

/**
 * Maps a Pearson r to a plain-language strength + direction label.
 * Thresholds follow the common |r| bands: >=0.7 strong, >=0.4 moderate, >=0.1 weak.
 */
export function describeCorrelation(r: number | null): CorrelationLabel {
  if (r === null) return { text: "Not enough data", tone: "none" };

  const abs = Math.abs(r);
  if (abs < 0.1) return { text: "No Linear Relationship", tone: "none" };

  const direction = r > 0 ? "Positive" : "Negative";
  const tone: CorrelationTone = r > 0 ? "positive" : "negative";

  const strength = abs >= 0.7 ? "Strong" : abs >= 0.4 ? "Moderate" : "Weak";

  return { text: `${strength} ${direction} Trend`, tone };
}

/** Formats r as a signed, two-decimal value between -1.00 and +1.00 (— when undefined). */
export function formatCorrelation(r: number | null): string {
  if (r === null) return "—";
  const sign = r > 0 ? "+" : r < 0 ? "−" : "";
  return `${sign}${Math.abs(r).toFixed(2)}`;
}
