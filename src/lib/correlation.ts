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
 * Aligns branded-search clicks with one TikTok metric by date, drops any day where
 * either value is missing or non-finite, then returns the Pearson correlation.
 */
export function correlateWithBranded(
  branded: BrandedSearchResponse | null,
  tiktokSeries: TikTokPoint[] | null,
  metric: TikTokMetric,
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
    const clicks = clicksByDate.get(point.date);
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
