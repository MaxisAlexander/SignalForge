"use client";

import { CopyChip } from "@/components/CopyChip";
import { enrichSignal } from "@/lib/signal-plans";
import { spotTradeUrl } from "@/lib/sodex-spot-sign";
import type { TradeSignal } from "@/lib/types";

const LEVERAGE_OPTS = [1, 5, 10, 15, 20, 25] as const;

function pairToApiSymbol(pair: string): string {
  const [base, quote = "USDC"] = pair.split("/");
  return `v${base}_v${quote}`;
}

function futuresTradeUrl(pair: string): string {
  const [base, quote = "USDC"] = pair.split("/");
  return `https://testnet.sodex.com/trade/futures/${base}_${quote}`;
}

function BriefRow({
  label,
  value,
  copyValue,
  accent,
}: {
  label: string;
  value: string;
  copyValue?: string;
  accent?: "buy" | "sell";
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="flex items-center justify-end gap-0">
        <span
          className={`font-semibold text-sm ${
            accent === "buy"
              ? "text-emerald-400"
              : accent === "sell"
                ? "text-red-400"
                : "text-white"
          }`}
        >
          {value}
        </span>
        {copyValue ? <CopyChip value={copyValue} /> : null}
      </dd>
    </div>
  );
}

export function MatchPanel({
  signal,
  market,
}: {
  signal: TradeSignal;
  market: "spot" | "futures";
}) {
  const s =
    signal.spot && signal.futures ? signal : enrichSignal(signal) ?? signal;
  const isSpot = market === "spot";
  const spot = s.spot;
  const futures = s.futures;

  function openTestnet() {
    const url = isSpot
      ? spotTradeUrl(pairToApiSymbol(spot.pair))
      : futuresTradeUrl(futures.pair);
    const lines = isSpot
      ? [
          `Pair: ${spot.pair}`,
          `Side: ${spot.side}`,
          `Type: ${spot.orderType}`,
          `Amount: ${spot.amount} ${spot.amountUnit}`,
          spot.orderType === "LIMIT" ? `Price: ${spot.priceUsdc}` : "",
        ]
      : [
          `Pair: ${futures.pair}`,
          `Position: ${futures.sideLabel}`,
          `Margin: ${futures.marginMode}`,
          `Leverage: ${futures.leverage}x`,
          `Amount: ${futures.amount} ${futures.amountUnit}`,
          `Price: ${futures.priceUsdc}`,
          `TP: ${futures.takeProfitPrice}`,
          `SL: ${futures.stopLossPrice}`,
          `Reduce only: ${futures.reduceOnly ? "Yes" : "No"}`,
        ];
    void navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div
        className={`border-b border-[var(--border)] px-5 py-4 ${
          isSpot
            ? "bg-gradient-to-r from-cyan-950/40 to-[var(--surface)]"
            : "bg-gradient-to-r from-violet-950/40 to-[var(--surface)]"
        }`}
      >
        <p className="text-xs uppercase text-[var(--muted)]">
          Selected {isSpot ? "Spot" : "Futures"} signal
        </p>
        <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{s.summary}</p>
        {s.verification?.verified && (
          <p className="mt-2 text-xs text-emerald-300">
            ✓ {s.verification.summary}
          </p>
        )}
      </div>

      <div className="p-5">
        {isSpot ? (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
            <p className="text-xs font-semibold uppercase text-cyan-400">Spot match</p>
            <dl className="mt-4 space-y-3">
              <BriefRow label="Token pair" value={spot.pair} />
              <BriefRow label="Market" value={spot.market} />
              <BriefRow
                label="Buy or sell"
                value={spot.side}
                accent={spot.side === "BUY" ? "buy" : "sell"}
              />
              <BriefRow label="Market or limit" value={spot.orderType} />
              <BriefRow
                label="Amount"
                value={`${spot.amount} ${spot.amountUnit}`}
                copyValue={`${spot.amount} ${spot.amountUnit}`}
              />
              {spot.orderType === "LIMIT" && (
                <BriefRow
                  label="Price (USDC)"
                  value={`$${spot.priceUsdc} USD`}
                  copyValue={spot.priceUsdc}
                />
              )}
              <BriefRow label="Notional" value={`$${spot.notionalUsd} USD`} />
            </dl>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(
                  [
                    spot.pair,
                    spot.side,
                    spot.orderType,
                    `${spot.amount} ${spot.amountUnit}`,
                    spot.orderType === "LIMIT" ? spot.priceUsdc : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                );
                window.open(
                  spotTradeUrl(pairToApiSymbol(spot.pair)),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              className="mt-5 rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Open spot match on testnet
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
            <p className="text-xs font-semibold uppercase text-violet-400">
              Futures match
            </p>
            <dl className="mt-4 space-y-3">
              <BriefRow label="Token pair" value={futures.pair} />
              <BriefRow label="Market" value={futures.market} />
              <BriefRow label="Position" value={futures.sideLabel} />
              <BriefRow
                label="Margin"
                value={futures.marginMode === "cross" ? "Cross" : "Isolated"}
              />
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-xs text-[var(--muted)]">Leverage</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {LEVERAGE_OPTS.map((x) => (
                    <span
                      key={x}
                      className={`rounded px-2 py-0.5 text-xs font-mono ${
                        futures.leverage === x
                          ? "bg-violet-500 text-white"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {x}x
                    </span>
                  ))}
                </span>
              </div>
              <BriefRow label="Order type" value={futures.orderType} />
              <BriefRow
                label="Amount"
                value={`${futures.amount} ${futures.amountUnit}`}
                copyValue={`${futures.amount} ${futures.amountUnit}`}
              />
              <BriefRow
                label="Price (USDC)"
                value={`$${futures.priceUsdc} USD`}
                copyValue={futures.priceUsdc}
              />
              <BriefRow
                label="Reduce only"
                value={futures.reduceOnly ? "Yes" : "No"}
              />
              <BriefRow
                label="Take profit"
                value={`${futures.takeProfitPct}% · $${futures.takeProfitPrice}`}
                copyValue={futures.takeProfitPrice}
              />
              <BriefRow
                label="Stop loss"
                value={`${futures.stopLossPct}% · $${futures.stopLossPrice}`}
                copyValue={futures.stopLossPrice}
              />
            </dl>
            <button
              type="button"
              onClick={openTestnet}
              className="mt-5 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white"
            >
              Open futures match on testnet
            </button>
          </div>
        )}
      </div>
    </section>
  );
}