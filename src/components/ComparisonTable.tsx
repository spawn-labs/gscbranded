import type { BrandedSearchResponse } from "../lib/api";
import { formatDelta, formatDisplayDate, formatNumber, formatPct } from "../lib/dates";

interface ComparisonTableProps {
  data: BrandedSearchResponse | null;
  compareEnabled: boolean;
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
    </section>
  );
}
