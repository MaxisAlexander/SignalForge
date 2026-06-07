"use client";

import { useCallback, useEffect, useState } from "react";
import { ExecutionPanel } from "@/components/ExecutionPanel";
import { Header } from "@/components/Header";
import { MarketPulsePanel } from "@/components/MarketPulse";
import { hasSeenIntro, OnboardingModal } from "@/components/OnboardingModal";
import { ScanSkeleton } from "@/components/ScanSkeleton";
import { SignalMarketColumn } from "@/components/SignalMarketColumn";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import type {
  FocusPreset,
  MarketPulse,
  TradeSignal,
  WorkflowStep,
} from "@/lib/types";

const FOCUS_OPTIONS: { id: FocusPreset; label: string }[] = [
  { id: "btc-macro", label: "BTC Macro + ETF" },
  { id: "ai-sector", label: "AI Sector" },
  { id: "defi-rotation", label: "DeFi Rotation" },
  { id: "risk-off", label: "Risk-Off" },
  { id: "custom", label: "Custom query" },
];

const STEP_ORDER: WorkflowStep[] = ["scan", "analyze", "signal", "match"];
const CLIENT_PULSE_KEY = "sf_client_pulse";

const NO_STORE: RequestInit = { cache: "no-store" };

type ScanStatus = "idle" | "loading" | "ready" | "error";

function readStoredPulse(): MarketPulse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CLIENT_PULSE_KEY);
    if (!raw) return null;
    const { pulse } = JSON.parse(raw) as { at: number; pulse: MarketPulse };
    return pulse;
  } catch {
    return null;
  }
}

function writeStoredPulse(pulse: MarketPulse) {
  sessionStorage.setItem(
    CLIENT_PULSE_KEY,
    JSON.stringify({ at: Date.now(), pulse }),
  );
}

export default function AppPage() {
  const [step, setStep] = useState<WorkflowStep>("scan");
  const [pulse, setPulse] = useState<MarketPulse | null>(null);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [selection, setSelection] = useState<{
    market: "spot" | "futures";
    signalId: string;
  } | null>(null);
  const [focus, setFocus] = useState<FocusPreset>("btc-macro");
  const [customQuery, setCustomQuery] = useState("");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("loading");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [analysisRunId, setAnalysisRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [rescanWaitSec, setRescanWaitSec] = useState(0);

  const loadPulse = useCallback(async (force = false) => {
    if (!force) {
      const stored = readStoredPulse();
      if (stored) {
        setPulse(stored);
        setScanStatus("ready");
        return;
      }
    }

    setScanStatus("loading");
    setError(null);
    try {
      const url = force
        ? `/api/pulse?force=1&_=${Date.now()}`
        : `/api/pulse?_=${Date.now()}`;
      const res = await fetch(url, NO_STORE);
      const data = await res.json();
      const retryMs = Number(res.headers.get("X-SignalForge-Retry-After-Ms") || 0);
      if (retryMs > 0) setRescanWaitSec(Math.ceil(retryMs / 1000));

      if (!res.ok) {
        if (res.status === 429) {
          if (data.hotNews) {
            setPulse(data);
            writeStoredPulse(data);
            setScanStatus("ready");
            setError(
              typeof data.error === "string"
                ? data.error
                : "Using cached scan — wait before re-scanning SoSoValue.",
            );
            return;
          }
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "SoSoValue rate limit — wait 2 minutes before Re-scan.",
          );
        }
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Pulse fetch failed — check SOSO_API_KEY in .env.local",
        );
      }
      if (!data.hotNews || !Array.isArray(data.sectors)) {
        throw new Error("Invalid pulse response from server");
      }
      setPulse(data);
      writeStoredPulse(data);
      setScanStatus("ready");
      const cacheHit = res.headers.get("X-SignalForge-Cache");
      if (cacheHit?.startsWith("hit")) {
        setError(null);
      }
    } catch (e) {
      setScanStatus("error");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  const fetchPulseForAnalyze = useCallback(async (): Promise<MarketPulse> => {
    const bust = `_=${Date.now()}`;
    let res = await fetch(`/api/pulse?force=1&${bust}`, NO_STORE);
    let data = await res.json();

    if (!res.ok && res.status === 429 && data.hotNews) {
      return data as MarketPulse;
    }

    if (!res.ok || !data.hotNews) {
      res = await fetch(`/api/pulse?${bust}`, NO_STORE);
      data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not refresh scan data for analyze",
        );
      }
    }

    if (!data.hotNews || !Array.isArray(data.sectors)) {
      throw new Error("Invalid pulse response from server");
    }

    const next = data as MarketPulse;
    setPulse(next);
    writeStoredPulse(next);
    setScanStatus("ready");
    return next;
  }, []);

  const runAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setSignals([]);
    setSelection(null);
    setAnalyzedAt(null);
    const runId = Date.now();
    setAnalysisRunId(runId);

    try {
      const freshPulse = await fetchPulseForAnalyze();
      const res = await fetch(`/api/analyze?_=${runId}`, {
        ...NO_STORE,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          focus,
          query: focus === "custom" ? customQuery : undefined,
          pulse: freshPulse,
          fresh: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setPulse(data.pulse);
      writeStoredPulse(data.pulse);
      setSignals(data.signals ?? []);
      setAnalyzedAt(data.analyzedAt ?? new Date().toISOString());
      setSelection(
        data.signals?.[0]
          ? { market: "spot", signalId: data.signals[0].id }
          : null,
      );
      setStep("signal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAnalyzing(false);
    }
  }, [focus, customQuery, fetchPulseForAnalyze]);

  useEffect(() => {
    if (!hasSeenIntro()) setShowIntro(true);
  }, []);

  useEffect(() => {
    loadPulse(false);
  }, [loadPulse]);

  useEffect(() => {
    if (rescanWaitSec <= 0) return;
    const t = setInterval(() => {
      setRescanWaitSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [rescanWaitSec]);

  const selected =
    selection
      ? signals.find((s) => s.id === selection.signalId) ?? null
      : null;

  function goNext() {
    const i = STEP_ORDER.indexOf(step);
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]);
  }

  function goBack() {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]);
  }

  const canContinueScan = scanStatus === "ready" && pulse !== null;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a2744_0%,_#070b12_50%)]">
      {showIntro && (
        <OnboardingModal forceOpen onClose={() => setShowIntro(false)} />
      )}
      <Header variant="app" />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <WorkflowStepper active={step} />

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            {scanStatus === "error" && (
              <button
                type="button"
                onClick={() => loadPulse(true)}
                className="ml-3 underline hover:no-underline"
              >
                Retry scan
              </button>
            )}
          </div>
        )}

        {step === "scan" && (
          <section className="glass rounded-2xl p-5">
            <h2 className="text-lg font-semibold">Step 1 — Scan</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ingest live SoSoValue data · cached 5 min · Re-scan limited
            </p>

            {scanStatus === "loading" && <ScanSkeleton />}

            {scanStatus === "ready" && pulse && (
              <div className="mt-4">
                {pulse.warnings?.map((w) => (
                  <p
                    key={w}
                    className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90"
                  >
                    {w}
                  </p>
                ))}
                <p className="mb-4 text-sm text-emerald-400/90">
                  ✓ {pulse.hotNews.length} headlines · {pulse.indices.length}{" "}
                  SSI indexes · {pulse.sectors.length} sectors
                  {pulse.etfBtc.length ? " · BTC ETF flow" : ""}
                </p>
                <MarketPulsePanel pulse={pulse} />
              </div>
            )}

            {scanStatus === "error" && !pulse && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-[var(--muted)]">
                <p>Scan could not load live data.</p>
                <p className="mt-2">
                  Ensure <code className="text-amber-300">SOSO_API_KEY</code> is
                  set in <code className="text-amber-300">.env.local</code> and
                  restart <code className="text-amber-300">npm run dev</code>.
                </p>
              </div>
            )}

            {scanStatus === "idle" && (
              <p className="mt-6 text-sm text-[var(--muted)]">
                Press Scan to load market data.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => loadPulse(true)}
                disabled={scanStatus === "loading" || rescanWaitSec > 0}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                {scanStatus === "loading"
                  ? "Scanning…"
                  : rescanWaitSec > 0
                    ? `Re-scan in ${rescanWaitSec}s`
                    : "Re-scan"}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canContinueScan}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-black disabled:opacity-40"
              >
                Continue to Analyze →
              </button>
            </div>
          </section>
        )}

        {step === "analyze" && (
          <section className="glass rounded-2xl p-5">
            <h2 className="text-lg font-semibold">Step 2 — Analyze</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Each analyze refreshes scan data and rebuilds verified signals (no
              stale cache)
            </p>
            {!pulse && (
              <p className="mt-4 text-sm text-amber-300">
                No scan data — go back to Step 1 and run a scan first.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setFocus(o.id)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    focus === o.id
                      ? "bg-amber-500 font-medium text-black"
                      : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {focus === "custom" && (
              <input
                className="mt-3 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                placeholder="e.g. ETF outflow, AI agents"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
              />
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={runAnalyze}
                disabled={analyzing}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                {analyzing ? "Analyzing…" : "Run analyze →"}
              </button>
            </div>
          </section>
        )}

        {step === "signal" && (
          <section>
            <div className="glass mb-4 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Step 3 — Signal</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Verified signals only — spot left, futures right
                {analyzedAt && (
                  <span className="block mt-1 text-emerald-400/80">
                    Last analyzed {new Date(analyzedAt).toLocaleString()}
                  </span>
                )}
              </p>
              {signals.length === 0 && (
                <p className="mt-4 text-sm text-amber-300">
                  No verified signals yet. Data must pass all checks (ETF flow ≥ $5M,
                  sector spread ≥ 1.5%, 3+ news tags, index move ≥ 0.5%). Re-scan and
                  analyze.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={runAnalyze}
                  disabled={analyzing}
                  className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm text-amber-200 disabled:opacity-50"
                >
                  {analyzing ? "Refreshing…" : "New analyze"}
                </button>
                {signals.length > 0 && (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!selection}
                    className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-black disabled:opacity-40"
                  >
                    Continue to Match →
                  </button>
                )}
              </div>
            </div>
            {(signals.length > 0 || analyzing) && (
              <div className="grid gap-4 lg:grid-cols-2">
                {analyzing ? (
                  <p className="col-span-2 text-sm text-[var(--muted)]">
                    Rebuilding signals from latest scan…
                  </p>
                ) : null}
                <SignalMarketColumn
                  key={`spot-${analysisRunId}`}
                  market="spot"
                  signals={signals}
                  selection={selection}
                  onSelect={(signalId) =>
                    setSelection({ market: "spot", signalId })
                  }
                />
                <SignalMarketColumn
                  key={`futures-${analysisRunId}`}
                  market="futures"
                  signals={signals}
                  selection={selection}
                  onSelect={(signalId) =>
                    setSelection({ market: "futures", signalId })
                  }
                />
              </div>
            )}
          </section>
        )}

        {step === "match" && (
          <section>
            <div className="glass mb-4 rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Step 4 — Match</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selection
                  ? `Showing your selected ${selection.market} signal`
                  : "Select a signal card first"}
              </p>
              <button
                type="button"
                onClick={goBack}
                className="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              >
                ← Back to signals
              </button>
            </div>
            {selected && selection ? (
              <ExecutionPanel signal={selected} market={selection.market} />
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Select a signal in step 3 first.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}