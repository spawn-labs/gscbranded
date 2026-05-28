import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { ErrorAlert } from "./components/ErrorAlert";
import { DateControls } from "./components/DateControls";
import { BrandedSearchChart } from "./components/BrandedSearchChart";
import { ComparisonTable } from "./components/ComparisonTable";
import { TikTokPanel } from "./components/TikTokPanel";
import {
  fetchAuthStatus,
  fetchBrandedSearch,
  fetchBusinessUnits,
  fetchTikTokMetrics,
  logout,
  type BusinessUnitOption,
  type BrandedSearchResponse,
  type CompareMode,
  type TikTokMetric,
  type TikTokPoint,
} from "./lib/api";
import { defaultRange } from "./lib/dates";

export default function App() {
  const range = defaultRange();
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [compare, setCompare] = useState<CompareMode>("prior_year");
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [businessUnit, setBusinessUnit] = useState("all");
  const [data, setData] = useState<BrandedSearchResponse | null>(null);
  const [tiktokSeries, setTiktokSeries] = useState<TikTokPoint[] | null>(null);
  const [tiktokMessage, setTiktokMessage] = useState<string>();
  const [showTiktok, setShowTiktok] = useState(false);
  const [tiktokMetrics, setTiktokMetrics] = useState<TikTokMetric[]>(["followers", "likes"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [gsc, tiktok] = await Promise.all([
        fetchBrandedSearch(start, end, compareEnabled ? compare : "prior_year", businessUnit),
        showTiktok ? fetchTikTokMetrics(start, end) : Promise.resolve(null),
      ]);
      setData(gsc);
      if (tiktok) {
        setTiktokSeries(tiktok.series);
        setTiktokMessage(tiktok.message);
      } else if (!showTiktok) {
        setTiktokSeries(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      if (msg.includes("Not authenticated") || msg.includes("Session expired")) {
        setAuthenticated(false);
        setError("Please connect Google Search Console again.");
      } else if (msg.includes("rate limit")) {
        setError("Google Search Console rate limit exceeded. Try again in a few minutes.");
      } else {
        setError(msg);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, start, end, compare, compareEnabled, showTiktok, businessUnit]);

  useEffect(() => {
    fetchAuthStatus().then((ok) => {
      setAuthenticated(ok);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    fetchBusinessUnits()
      .then((units) => {
        if (units.length === 0) {
          setBusinessUnits([{ id: "all", label: "all", keywordCount: 0 }]);
          return;
        }
        setBusinessUnits(units);
        if (!units.some((u) => u.id === businessUnit)) {
          setBusinessUnit(units[0].id);
        }
      })
      .catch(() => {
        setBusinessUnits([{ id: "all", label: "all", keywordCount: 0 }]);
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setError(`Google sign-in failed: ${authError}`);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (authenticated && authChecked) {
      loadData();
    }
  }, [authenticated, authChecked]); // initial load only when auth ready

  useEffect(() => {
    if (authenticated && showTiktok) {
      fetchTikTokMetrics(start, end)
        .then((res) => {
          setTiktokSeries(res.series);
          setTiktokMessage(res.message);
        })
        .catch(() => setTiktokMessage("Could not load TikTok metrics."));
    }
  }, [authenticated, showTiktok, start, end]);

  const handleConnect = () => {
    window.location.href = "/api/auth/google";
  };

  const handleDisconnect = async () => {
    await logout();
    setAuthenticated(false);
    setData(null);
    setTiktokSeries(null);
  };

  const handleApply = () => {
    if (start > end) {
      setError("End date must be on or after start date.");
      return;
    }
    loadData();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        authenticated={authenticated}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        {!authenticated && authChecked && (
          <section className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 p-8 text-center">
            <h2 className="font-display text-2xl font-semibold">Welcome</h2>
            <p className="mx-auto mt-2 max-w-lg text-[var(--color-muted)]">
              Connect your Google Search Console account to explore how branded search clicks
              trend over time — and overlay TikTok activity to spot correlations.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              className="mt-6 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] px-6 py-3 font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:opacity-90"
            >
              Connect Google Search Console
            </button>
          </section>
        )}

        {authenticated && (
          <>
            <DateControls
              start={start}
              end={end}
              compare={compare}
              compareEnabled={compareEnabled}
              businessUnit={businessUnit}
              businessUnits={businessUnits}
              loading={loading}
              onStartChange={setStart}
              onEndChange={setEnd}
              onCompareChange={setCompare}
              onCompareEnabledChange={setCompareEnabled}
              onBusinessUnitChange={setBusinessUnit}
              onApply={handleApply}
            />

            <BrandedSearchChart
              data={data}
              compareEnabled={compareEnabled}
              tiktokSeries={showTiktok ? tiktokSeries : null}
              tiktokMetrics={showTiktok ? tiktokMetrics : []}
              loading={loading}
            />

            <ComparisonTable data={data} compareEnabled={compareEnabled} />

            <TikTokPanel
              show={showTiktok}
              onShowChange={setShowTiktok}
              selected={tiktokMetrics}
              onSelectedChange={setTiktokMetrics}
              tiktokMessage={tiktokMessage}
            />
          </>
        )}
      </main>

      <footer className="border-t border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-muted)]">
        Branded Search Explorer · Credentials stay server-side on Cloudflare
      </footer>
    </div>
  );
}
