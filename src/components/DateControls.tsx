import type { CompareMode } from "../lib/api";
import { formatDisplayDate } from "../lib/dates";

interface DateControlsProps {
  start: string;
  end: string;
  compare: CompareMode;
  compareEnabled: boolean;
  loading: boolean;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onCompareChange: (v: CompareMode) => void;
  onCompareEnabledChange: (v: boolean) => void;
  onApply: () => void;
}

export function DateControls({
  start,
  end,
  compare,
  compareEnabled,
  loading,
  onStartChange,
  onEndChange,
  onCompareChange,
  onCompareEnabledChange,
  onApply,
}: DateControlsProps) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4 sm:p-6">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        Date range
      </h2>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-muted)]">From</span>
          <input
            type="date"
            value={start}
            max={end}
            onChange={(e) => onStartChange(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-muted)]">To</span>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => onEndChange(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => onCompareEnabledChange(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--color-primary)]"
          />
          <span>Show comparison period</span>
        </label>
        {compareEnabled && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-muted)]">Compare to</span>
            <select
              value={compare}
              onChange={(e) => onCompareChange(e.target.value as CompareMode)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)]"
            >
              <option value="prior_year">Same dates, prior year</option>
              <option value="prior_period">Previous period (same length)</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        Showing {formatDisplayDate(start)} – {formatDisplayDate(end)}
        {compareEnabled &&
          (compare === "prior_year"
            ? " vs same range last year"
            : " vs previous period of equal length")}
      </p>
    </section>
  );
}
