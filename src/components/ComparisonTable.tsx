import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { BrandedSearchResponse } from "../lib/api";
import { formatDelta, formatDisplayDate, formatNumber, formatPct } from "../lib/dates";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

interface ComparisonTableProps {
  data: BrandedSearchResponse | null;
  compareEnabled: boolean;
}

function dailyDeltaSeries(data: BrandedSearchResponse): number[] {
  const comp = data.comparison.series;
  return data.current.series.map((point, i) => point.clicks - (comp[i]?.clicks ?? 0));
}

export function ComparisonTable({ data, compareEnabled }: ComparisonTableProps) {
  if (!data) return null;

  const rows = [
    {
      label: "Current period",
      range: `${formatDisplayDate(data.current.start)} – ${formatDisplayDate(data.current.end)}`,
      total: data.current.total,
    },
  ];

  if (compareEnabled) {
    rows.push({
      label:
        data.comparison.mode === "prior_year"
          ? "Prior year (same dates)"
          : "Prior period",
      range: `${formatDisplayDate(data.comparison.start)} – ${formatDisplayDate(data.comparison.end)}`,
      total: data.comparison.total,
    });
  }

  const deltaPositive = data.delta >= 0;
  const labels = data.current.series.map((p) => formatDisplayDate(p.date));
  const dailyDelta = compareEnabled ? dailyDeltaSeries(data) : [];
  const zeroLine = dailyDelta.map(() => 0);

  const deltaChartData = {
    labels,
    datasets: [
      {
        label: "Daily delta (current − comparison)",
        data: dailyDelta,
        borderColor: "#818cf8",
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        fill: "origin",
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: "Zero",
        data: zeroLine,
        borderColor: "#64748b",
        borderDash: [4, 4],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4 sm:p-6">
      <h2 className="font-display text-lg font-semibold">Aggregate summary</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
              <th className="pb-3 pr-4 font-medium">Period</th>
              <th className="pb-3 pr-4 font-medium">Range</th>
              <th className="pb-3 text-right font-medium">Branded clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-[var(--color-border)]/60">
                <td className="py-3 pr-4 font-medium">{row.label}</td>
                <td className="py-3 pr-4 text-[var(--color-muted)]">{row.range}</td>
                <td className="py-3 text-right tabular-nums">{formatNumber(row.total)}</td>
              </tr>
            ))}
            {compareEnabled && (
              <tr className="bg-[var(--color-surface-2)]/50">
                <td className="py-3 pr-4 font-semibold" colSpan={2}>
                  Delta (current vs comparison)
                </td>
                <td
                  className={`py-3 text-right font-semibold tabular-nums ${
                    deltaPositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                  }`}
                >
                  {formatDelta(data.delta)}
                  <span className="ml-2 text-xs font-normal opacity-80">
                    ({formatPct(data.deltaPct)})
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {compareEnabled && dailyDelta.length > 0 && (
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <h3 className="font-display text-sm font-semibold text-[var(--color-muted)]">
            Daily delta vs comparison
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Each point is current-period clicks minus comparison-period clicks. Above zero = growth;
            below zero = decline.
          </p>
          <div className="mt-4 h-52 sm:h-64">
            <Line
              data={deltaChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: {
                    labels: {
                      color: "#94a3b8",
                      filter: (item) => item.text !== "Zero",
                    },
                  },
                  tooltip: {
                    backgroundColor: "#1a2238",
                    titleColor: "#f1f5f9",
                    bodyColor: "#94a3b8",
                    filter: (item) => item.dataset.label !== "Zero",
                    callbacks: {
                      label: (ctx) => {
                        const v = ctx.parsed.y;
                        if (v === null || v === undefined) return "";
                        const sign = v > 0 ? "+" : "";
                        return `Delta: ${sign}${formatNumber(v)} clicks`;
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: "#64748b", maxTicksLimit: 10, font: { size: 10 } },
                    grid: { color: "rgba(42, 53, 85, 0.4)" },
                  },
                  y: {
                    ticks: { color: "#64748b" },
                    grid: {
                      color: (ctx) =>
                        ctx.tick.value === 0
                          ? "rgba(148, 163, 184, 0.6)"
                          : "rgba(42, 53, 85, 0.35)",
                      lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1),
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
