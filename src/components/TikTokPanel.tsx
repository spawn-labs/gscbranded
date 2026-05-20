import type { TikTokMetric } from "../lib/api";

const METRIC_OPTIONS: { id: TikTokMetric; label: string }[] = [
  { id: "followers", label: "Followers" },
  { id: "views", label: "Views" },
  { id: "likes", label: "Likes" },
  { id: "engagement", label: "Engagement" },
];

interface TikTokPanelProps {
  show: boolean;
  onShowChange: (v: boolean) => void;
  selected: TikTokMetric[];
  onSelectedChange: (v: TikTokMetric[]) => void;
  tiktokMessage?: string;
}

export function TikTokPanel({
  show,
  onShowChange,
  selected,
  onSelectedChange,
  tiktokMessage,
}: TikTokPanelProps) {
  const toggleMetric = (m: TikTokMetric) => {
    if (selected.includes(m)) {
      onSelectedChange(selected.filter((x) => x !== m));
    } else {
      onSelectedChange([...selected, m]);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-2)]/80 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">TikTok overlay</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Layer TikTok metrics on the branded search chart
          </p>
        </div>
        <button
          type="button"
          onClick={() => onShowChange(!show)}
          className="rounded-lg border border-[var(--color-accent-2)]/50 bg-[var(--color-accent-2)]/10 px-4 py-2 text-sm font-medium text-[var(--color-accent-2)] transition hover:bg-[var(--color-accent-2)]/20"
        >
          {show ? "Hide TikTok" : "Show TikTok"}
        </button>
      </div>
      {show && (
        <div className="mt-4 flex flex-wrap gap-3">
          {METRIC_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/50 px-3 py-2 text-sm transition has-[:checked]:border-[var(--color-accent-2)] has-[:checked]:bg-[var(--color-accent-2)]/10"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggleMetric(opt.id)}
                className="accent-[var(--color-accent-2)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
      {show && tiktokMessage && (
        <p className="mt-3 text-xs text-[var(--color-muted)]">{tiktokMessage}</p>
      )}
    </section>
  );
}
