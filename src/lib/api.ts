export interface DataPoint {
  date: string;
  clicks: number;
}

export interface BrandedSearchResponse {
  current: {
    start: string;
    end: string;
    series: DataPoint[];
    total: number;
  };
  comparison: {
    start: string;
    end: string;
    series: DataPoint[];
    total: number;
    mode: "prior_year" | "prior_period";
  };
  delta: number;
  deltaPct: number | null;
  siteUrl?: string;
  businessUnit?: string;
}

export interface TikTokPoint {
  date: string;
  followers: number;
  views: number;
  likes: number;
  engagement: number;
}

export type CompareMode = "prior_year" | "prior_period";

export type TikTokMetric = "followers" | "views" | "likes" | "engagement";

export interface TikTokStatus {
  oauthReady: boolean;
  metricsReady: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasOpenId: boolean;
  redirectUri: string | null;
  missing: string[];
  connectUrl: string | null;
}

export interface BusinessUnitOption {
  id: string;
  label: string;
  keywordCount: number;
}

export async function fetchAuthStatus(): Promise<boolean> {
  const res = await fetch("/api/auth/status");
  const data = (await res.json()) as { authenticated: boolean };
  return data.authenticated;
}

export async function fetchBrandedSearch(
  start: string,
  end: string,
  compare: CompareMode,
  businessUnit: string,
): Promise<BrandedSearchResponse> {
  const params = new URLSearchParams({ start, end, compare, businessUnit });
  const res = await fetch(`/api/gsc/branded-search?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load search data");
  }
  return data as BrandedSearchResponse;
}

export async function fetchBusinessUnits(): Promise<BusinessUnitOption[]> {
  const res = await fetch("/api/gsc/business-units");
  const data = (await res.json()) as { units: BusinessUnitOption[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load business units");
  }
  return data.units;
}

export async function fetchTikTokStatus(): Promise<TikTokStatus> {
  const res = await fetch("/api/tiktok/status");
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load TikTok status");
  }
  return data as TikTokStatus;
}

export async function fetchTikTokMetrics(
  start: string,
  end: string,
): Promise<{ series: TikTokPoint[]; message?: string; source: string }> {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`/api/tiktok/metrics?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load TikTok data");
  }
  return data;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
