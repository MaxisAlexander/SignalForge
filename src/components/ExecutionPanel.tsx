"use client";

import dynamic from "next/dynamic";
import type { TradeSignal } from "@/lib/types";

const MatchPanel = dynamic(
  () =>
    import("./MatchPanel").then((m) => ({
      default: m.MatchPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <section className="glass rounded-2xl p-5 text-sm text-[var(--muted)]">
        Loading match…
      </section>
    ),
  },
);

export function ExecutionPanel({
  signal,
  market,
}: {
  signal: TradeSignal | null;
  market: "spot" | "futures" | null;
}) {
  if (!signal || !market) {
    return (
      <section className="glass rounded-2xl p-5 text-sm text-[var(--muted)]">
        Select one spot or futures signal card, then continue to Match.
      </section>
    );
  }

  return <MatchPanel signal={signal} market={market} />;
}