import type { MarketPulse } from "@/lib/types";

function pct(n: number) {
  const v = n * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function MarketPulsePanel({ pulse }: { pulse: MarketPulse }) {
  const etf = pulse.etfBtc[0];
  const etfM = etf ? etf.total_net_inflow / 1e6 : 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Market Pulse</h2>
          <p className="text-xs text-[var(--muted)]">
            Live · {new Date(pulse.fetchedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pulse.apiModulesUsed.map((m) => (
            <span
              key={m}
              className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300"
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">BTC ETF net flow</p>
          {etf ? (
            <>
              <p
                className={`text-2xl font-semibold ${etfM < 0 ? "text-[var(--bear)]" : "text-[var(--bull)]"}`}
              >
                {etfM >= 0 ? "+" : ""}
                {etfM.toFixed(1)}M USD
              </p>
              <p className="text-xs text-[var(--muted)]">{etf.date}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-amber-400/90">—</p>
              <p className="text-xs text-[var(--muted)]">
                Rate limited — ETF from hot news context
              </p>
            </>
          )}
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">Top sector 24h</p>
          <p className="text-2xl font-semibold text-[var(--bull)]">
            {[...pulse.sectors].sort(
              (a, b) => b.change_pct_24h - a.change_pct_24h,
            )[0]?.name ?? "—"}
          </p>
          <p className="text-xs">
            {pulse.sectors.length
              ? pct(
                  [...pulse.sectors].sort(
                    (a, b) => b.change_pct_24h - a.change_pct_24h,
                  )[0].change_pct_24h,
                )
              : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">Hot news loaded</p>
          <p className="text-2xl font-semibold">{pulse.hotNews.length}</p>
          <p className="text-xs text-[var(--muted)]">clusters from /news/hot</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">SSI snapshots</h3>
          <div className="space-y-2">
            {pulse.indices.map((idx) => (
              <div
                key={idx.ticker}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm"
              >
                <span className="font-mono text-cyan-300">{idx.ticker}</span>
                <span
                  className={
                    idx.change_pct_24h >= 0
                      ? "text-[var(--bull)]"
                      : "text-[var(--bear)]"
                  }
                >
                  {pct(idx.change_pct_24h)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">
            Macro calendar
          </h3>
          <ul className="mb-4 space-y-1 text-xs text-[var(--muted)]">
            {pulse.macroEvents.slice(0, 3).map((d) => (
              <li key={d.date}>
                <span className="text-amber-400">{d.date}</span>:{" "}
                {d.events.join(", ")}
              </li>
            ))}
          </ul>
          {pulse.featuredNews.length > 0 && (
            <>
              <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">
                Featured research
              </h3>
              <ul className="mb-4 max-h-32 space-y-2 overflow-y-auto text-sm">
                {pulse.featuredNews.slice(0, 3).map((n) => (
                  <li key={n.id}>
                    <a
                      href={n.source_link}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 hover:text-cyan-400"
                    >
                      {n.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="mb-2 text-sm font-medium text-[var(--muted)]">Hot headlines</h3>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {pulse.hotNews.slice(0, 6).map((n) => (
              <li key={n.id}>
                <a
                  href={n.source_link}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 hover:text-amber-400"
                >
                  {n.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}