"use client";

import { CopyChip } from "@/components/CopyChip";
import { enrichSignal } from "@/lib/signal-plans";
import type { TradeSignal } from "@/lib/types";

const LEVERAGE_OPTS = [1, 5, 10, 15, 20, 25] as const;
const DIR_STYLES = {
  bullish: "text-[var(--bull)] border-emerald-500/30 bg-emerald-500/10",
  bearish: "text-[var(--bear)] border-red-500/30 bg-red-500/10",
  neutral: "text-[var(--muted)] border-[var(--border)] bg-[var(--surface-2)]",
  watch: "text-[var(--watch)] border-violet-500/30 bg-violet-500/10",
};

function PlanRow({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="flex items-center font-medium text-white">
        {value}
        {copyValue ? <CopyChip value={copyValue} /> : null}
      </span>
    </div>
  );
}

function ensureSignal(signal: TradeSignal): TradeSignal {
  if (signal.spot && signal.futures) return signal;
  return enrichSignal(signal) ?? signal;
}

function VerifiedBadge({ signal }: { signal: TradeSignal }) {
  const v = signal.verification;
  if (!v?.verified) return null;
  return (
    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
      ✓ Verified · {v.checksPassed}/{v.checksTotal} checks
    </span>
  );
}

function SpotSignalCard({
  signal,
  rank,
  selected,
  onSelect,
}: {
  signal: TradeSignal;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = ensureSignal(signal);
  const spot = s.spot;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-cyan-500/70 ring-1 ring-cyan-500/40"
          : "border-[var(--border)] hover:border-cyan-500/40"
      } bg-[var(--surface)]`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--muted)]">#{rank}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <VerifiedBadge signal={signal} />
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${DIR_STYLES[signal.direction]}`}
          >
            {signal.direction}
          </span>
        </div>
      </div>
      <h3 className="text-sm font-semibold leading-snug">{signal.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{signal.summary}</p>
      <div className="mt-3 space-y-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
        <PlanRow label="Pair" value={spot.pair} />
        <PlanRow label="Side" value={spot.side} />
        <PlanRow label="Type" value={spot.orderType} />
        <PlanRow
          label="Amount"
          value={`${spot.amount} ${spot.amountUnit}`}
          copyValue={`${spot.amount} ${spot.amountUnit}`}
        />
        {spot.orderType === "LIMIT" && (
          <PlanRow
            label="Price (USDC)"
            value={`$${spot.priceUsdc} USD`}
            copyValue={spot.priceUsdc}
          />
        )}
        <PlanRow label="Notional" value={`$${spot.notionalUsd}`} />
      </div>
      <p className="mt-2 text-[10px] font-mono text-[var(--muted)]">
        {signal.confidence}% confidence
      </p>
    </button>
  );
}

function FuturesSignalCard({
  signal,
  rank,
  selected,
  onSelect,
}: {
  signal: TradeSignal;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = ensureSignal(signal);
  const f = s.futures;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-violet-500/70 ring-1 ring-violet-500/40"
          : "border-[var(--border)] hover:border-violet-500/40"
      } bg-[var(--surface)]`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--muted)]">#{rank}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <VerifiedBadge signal={signal} />
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${DIR_STYLES[signal.direction]}`}
          >
            {signal.direction}
          </span>
        </div>
      </div>
      <h3 className="text-sm font-semibold leading-snug">{signal.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{signal.summary}</p>
      <div className="mt-3 space-y-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
        <PlanRow label="Pair" value={f.pair} />
        <PlanRow label="Position" value={f.sideLabel} />
        <PlanRow
          label="Margin"
          value={f.marginMode === "cross" ? "Cross" : "Isolated"}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[var(--muted)]">Leverage</span>
          <div className="flex flex-wrap justify-end gap-0.5">
            {LEVERAGE_OPTS.map((x) => (
              <span
                key={x}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                  f.leverage === x
                    ? "bg-violet-500 text-white"
                    : "text-[var(--muted)]"
                }`}
              >
                {x}x
              </span>
            ))}
          </div>
        </div>
        <PlanRow label="Order" value={f.orderType} />
        <PlanRow
          label="Amount"
          value={`${f.amount} ${f.amountUnit}`}
          copyValue={`${f.amount} ${f.amountUnit}`}
        />
        <PlanRow
          label="Price (USDC)"
          value={`$${f.priceUsdc} USD`}
          copyValue={f.priceUsdc}
        />
        <PlanRow label="Reduce only" value={f.reduceOnly ? "Yes" : "No"} />
        <PlanRow
          label="TP"
          value={`${f.takeProfitPct}% · $${f.takeProfitPrice}`}
          copyValue={f.takeProfitPrice}
        />
        <PlanRow
          label="SL"
          value={`${f.stopLossPct}% · $${f.stopLossPrice}`}
          copyValue={f.stopLossPrice}
        />
      </div>
      <p className="mt-2 text-[10px] font-mono text-[var(--muted)]">
        {signal.confidence}% confidence
      </p>
    </button>
  );
}

export function SignalMarketColumn({
  market,
  signals,
  selection,
  onSelect,
}: {
  market: "spot" | "futures";
  signals: TradeSignal[];
  selection: { market: "spot" | "futures"; signalId: string } | null;
  onSelect: (signalId: string) => void;
}) {
  const isSpot = market === "spot";
  const isSelected = (signalId: string) =>
    selection?.market === market && selection.signalId === signalId;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isSpot
          ? "border-cyan-500/30 bg-cyan-950/20"
          : "border-violet-500/30 bg-violet-950/20"
      }`}
    >
      <div className="mb-4 border-b border-[var(--border)] pb-3">
        <h3
          className={`text-sm font-semibold uppercase tracking-wide ${
            isSpot ? "text-cyan-400" : "text-violet-400"
          }`}
        >
          {isSpot ? "Spot" : "Futures"}
        </h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {isSpot
            ? "Verified · live CoinGecko + Binance spot · sized for ≤ $1,000 USDC wallet"
            : "Verified · limit orders · leverage capped for ≤ $1,000 wallet"}
        </p>
      </div>
      {signals.length === 0 ? (
        <p className="text-xs text-amber-200/90">
          No verified {isSpot ? "spot" : "futures"} signals yet. Run scan + analyze when
          ETF, sector, news, or index thresholds are met.
        </p>
      ) : (
        <div className="space-y-3">
          {signals.map((s, i) =>
            isSpot ? (
              <SpotSignalCard
                key={`spot-${s.id}`}
                signal={s}
                rank={i + 1}
              selected={isSelected(s.id)}
              onSelect={() => onSelect(s.id)}
            />
          ) : (
            <FuturesSignalCard
              key={`futures-${s.id}`}
              signal={s}
              rank={i + 1}
              selected={isSelected(s.id)}
              onSelect={() => onSelect(s.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}