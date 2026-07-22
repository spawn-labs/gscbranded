import type { BrandedSearchResponse, TikTokMetric, TikTokPoint } from "../lib/api";
import {
  BRANDED_SEARCH_LAG_DAYS,
  correlateWithBranded,
  describeCorrelation,
  formatCorrelation,
  type CorrelationTone,
} from "../lib/correlation";

// lagDays: how many days branded search is assumed to trail this metric. Per-day
// metrics get the social→search lag; Followers is a cumulative trend, compared same-day.
const METRICS: { id: TikTokMetric; label: string; lagDays: number }[] = [
  { id: "followers", label: "Followers", lagDays: 0 },
  { id: "views", label: "Views", lagDays: BRANDED_SEARCH_LAG_DAYS },
  { id: "likes", label: "Likes", lagDays: BRANDED_SEARCH_LAG_DAYS },
  { id: "engagement", label: "Engagement", lagDays: BRANDED_SEARCH_LAG_DAYS },
];

const TONE_CLASS: Record<CorrelationTone, string> = {
  positive: "text-[var(--color-success)]",
  negative: "text-[var(--color-danger)]",
  none: "text-[var(--color-muted)]",
};

interface CorrelationPanelProps {
  data: BrandedSearchResponse | null;
  tiktokSeries: TikTokPoint[] | null;
}

export function CorrelationPanel({ data, tiktokSeries }: CorrelationPanelProps) {
  if (!data || !tiktokSeries || tiktokSeries.length === 0) return null;

  const results = METRICS.map((metric) => ({
    ...metric,
    ...correlateWithBranded(data, tiktokSeries, metric.id, metric.lagDays),
  }));

  const sampleSize = results.reduce((max, res) => Math.max(max, res.n), 0);

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Branded search vs TikTok correlation</h2>
        <span className="text-xs text-[var(--color-muted)]">
          Pearson r · {sampleSize} matched day{sampleSize === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        How closely each TikTok metric moves with branded search clicks over the selected range.
        −1.00 = perfect inverse · 0 = no linear link · +1.00 = perfect match.
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Views, Likes &amp; Engagement are compared against branded search{" "}
        {BRANDED_SEARCH_LAG_DAYS} days later, modelling the typical delay between social
        activity and the branded searches it drives. Followers, a cumulative trend, is
        compared same-day.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {results.map((res) => {
          const label = describeCorrelation(res.r);
          return (
            <div
              key={res.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-4"
            >
              <div className="text-sm text-[var(--color-muted)]">{res.label}</div>
              <div
                className={`mt-1 font-display text-3xl font-semibold tabular-nums ${TONE_CLASS[label.tone]}`}
              >
                {formatCorrelation(res.r)}
              </div>
              <div className={`mt-1 text-xs font-medium ${TONE_CLASS[label.tone]}`}>
                {label.text}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
