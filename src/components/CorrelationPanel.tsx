import type { BrandedSearchResponse, TikTokMetric, TikTokPoint } from "../lib/api";
import {
  correlateWithBranded,
  describeCorrelation,
  formatCorrelation,
  type CorrelationTone,
} from "../lib/correlation";

const METRICS: { id: TikTokMetric; label: string }[] = [
  { id: "followers", label: "Followers" },
  { id: "views", label: "Views" },
  { id: "likes", label: "Likes" },
  { id: "engagement", label: "Engagement" },
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
    ...correlateWithBranded(data, tiktokSeries, metric.id),
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
