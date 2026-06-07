"use client";

import Link from "next/link";
import { useState } from "react";

const STEPS = [
  {
    n: 1,
    title: "Scan",
    desc: "Ingest live SoSoValue data",
    detail: "Hot news, sectors, ETF flows, and SSI snapshots from the Open API.",
  },
  {
    n: 2,
    title: "Analyze",
    desc: "Agent fuses news + flows",
    detail: "ETF, sentiment, and sector data merge into one scored view.",
  },
  {
    n: 3,
    title: "Signal",
    desc: "Verified spot & futures plans",
    detail:
      "Data-backed signals only — separate Spot and Futures columns with leverage, TP/SL, and amounts.",
  },
  {
    n: 4,
    title: "Match",
    desc: "Your selected trade plan",
    detail:
      "The card you picked opens here — copy amount, price, TP, SL and trade on testnet.sodex.com.",
  },
];

export function WorkflowCarousel() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <div className="mt-10 max-w-xl">
      <div className="mb-4 flex gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setActive(i)}
            className={`h-2 flex-1 rounded-full transition ${
              i === active ? "bg-amber-500" : "bg-white/20 hover:bg-white/35"
            }`}
            aria-label={`Step ${s.n}: ${s.title}`}
          />
        ))}
      </div>

      <div
        key={step.n}
        className="min-h-[140px] rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-sm"
      >
        <span className="text-xs font-mono text-amber-400">Step {step.n}</span>
        <p className="mt-2 text-xl font-semibold">{step.title}</p>
        <p className="text-sm text-cyan-400/90">{step.desc}</p>
        <p className="mt-3 text-sm text-[var(--muted)]">{step.detail}</p>
      </div>

      <div className="mt-4 flex gap-3">
        {active > 0 && (
          <button
            type="button"
            onClick={() => setActive((a) => a - 1)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-[var(--muted)] hover:text-white"
          >
            Back
          </button>
        )}
        {active < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setActive((a) => a + 1)}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Next step →
          </button>
        ) : (
          <Link
            href="/app"
            className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-black"
          >
            Launch app →
          </Link>
        )}
      </div>
    </div>
  );
}