import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { BrandedSearchResponse, TikTokMetric, TikTokPoint } from "../lib/api";
import { formatDisplayDate } from "../lib/dates";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const TIKTOK_COLORS: Record<TikTokMetric, string> = {
  followers: "#34d399",
  views: "#f59e0b",
  likes: "#ec4899",
  engagement: "#22d3ee",
};

interface BrandedSearchChartProps {
  data: BrandedSearchResponse | null;
  compareEnabled: boolean;
  tiktokSeries: TikTokPoint[] | null;
  tiktokMetrics: TikTokMetric[];
  loading: boolean;
}

function alignTikTokToLabels(
  labels: string[],
  series: TikTokPoint[],
  metric: TikTokMetric,
): (number | null)[] {
  const map = new Map(series.map((p) => [p.date, p[metric]]));
  return labels.map((d) => map.get(d) ?? null);
}

export function BrandedSearchChart({
  data,
  compareEnabled,
  tiktokSeries,
  tiktokMetrics,
  loading,
}: BrandedSearchChartProps) {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 sm:h-96">
        <p className="animate-pulse text-[var(--color-muted)]">Loading chart…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/40 sm:h-96">
        <p className="text-center text-sm text-[var(--color-muted)] px-6">
          Connect Google Search Console and apply a date range to see branded search clicks.
        </p>
      </div>
    );
  }

  const labels = data.current.series.map((p) => p.date);
  const datasets: Parameters<typeof Line>[0]["data"]["datasets"] = [
    {
      label: `Branded clicks (${formatDisplayDate(data.current.start)} – ${formatDisplayDate(data.current.end)})`,
      data: data.current.series.map((p) => p.clicks),
      borderColor: "#818cf8",
      backgroundColor: "rgba(99, 102, 241, 0.15)",
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      yAxisID: "y",
    },
  ];

  if (compareEnabled && data.comparison.series.length > 0) {
    const compByIndex = data.comparison.series.map((p) => p.clicks);
    datasets.push({
      label:
        data.comparison.mode === "prior_year"
          ? "Comparison (prior year)"
          : "Comparison (prior period)",
      data: compByIndex.length === labels.length
        ? compByIndex
        : labels.map((_, i) => compByIndex[i] ?? null),
      borderColor: "#a78bfa",
      borderDash: [6, 4],
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      yAxisID: "y",
    });
  }

  if (tiktokSeries && tiktokMetrics.length > 0) {
    for (const metric of tiktokMetrics) {
      datasets.push({
        label: `TikTok ${metric}`,
        data: alignTikTokToLabels(labels, tiktokSeries, metric),
        borderColor: TIKTOK_COLORS[metric],
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "y1",
      });
    }
  }

  const hasTikTok = tiktokMetrics.length > 0;

  const chartData = {
    labels: labels.map((d) => formatDisplayDate(d)),
    datasets,
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Branded search clicks</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Daily aggregate clicks for queries matching your branded keywords
        {data.siteUrl && (
          <span className="block truncate text-xs opacity-80">{data.siteUrl}</span>
        )}
      </p>
      <div className="mt-4 h-72 sm:h-[28rem]">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: {
                labels: { color: "#94a3b8", boxWidth: 12, font: { size: 11 } },
              },
              tooltip: {
                backgroundColor: "#1a2238",
                titleColor: "#f1f5f9",
                bodyColor: "#94a3b8",
              },
            },
            scales: {
              x: {
                ticks: { color: "#64748b", maxTicksLimit: 12, font: { size: 10 } },
                grid: { color: "rgba(42, 53, 85, 0.5)" },
              },
              y: {
                position: "left",
                title: { display: true, text: "Clicks", color: "#94a3b8" },
                ticks: { color: "#64748b" },
                grid: { color: "rgba(42, 53, 85, 0.4)" },
                beginAtZero: true,
              },
              ...(hasTikTok
                ? {
                    y1: {
                      position: "right",
                      title: { display: true, text: "TikTok", color: "#94a3b8" },
                      ticks: { color: "#64748b" },
                      grid: { drawOnChartArea: false },
                      beginAtZero: true,
                    },
                  }
                : {}),
            },
          }}
        />
      </div>
    </div>
  );
}
