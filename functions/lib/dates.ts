export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const a = parseIsoDate(start).getTime();
  const b = parseIsoDate(end).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export function shiftDays(iso: string, delta: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + delta);
  return formatIsoDate(d);
}

export function priorYearRange(start: string, end: string): { start: string; end: string } {
  const s = parseIsoDate(start);
  const e = parseIsoDate(end);
  s.setUTCFullYear(s.getUTCFullYear() - 1);
  e.setUTCFullYear(e.getUTCFullYear() - 1);
  return { start: formatIsoDate(s), end: formatIsoDate(e) };
}

export function priorPeriodRange(
  start: string,
  end: string,
): { start: string; end: string } {
  const len = daysBetween(start, end);
  return {
    start: shiftDays(start, -len),
    end: shiftDays(start, -1),
  };
}

export function defaultRange(): { start: string; end: string } {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3); // GSC data lag ~3 days
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  start.setUTCDate(start.getUTCDate() + 1);
  return { start: formatIsoDate(start), end: formatIsoDate(end) };
}

export function seriesFromMap(
  map: Record<string, number>,
  start: string,
  end: string,
): { date: string; clicks: number }[] {
  const out: { date: string; clicks: number }[] = [];
  let cur = start;
  while (cur <= end) {
    out.push({ date: cur, clicks: map[cur] ?? 0 });
    cur = shiftDays(cur, 1);
  }
  return out;
}

export function totalClicks(series: { clicks: number }[]): number {
  return series.reduce((sum, r) => sum + r.clicks, 0);
}
