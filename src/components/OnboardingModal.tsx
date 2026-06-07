"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "signalforge_intro_seen";

const STEPS = [
  {
    n: 1,
    title: "Scan",
    subtitle: "Ingest live SoSoValue data",
    body: "Pull hot news, sector spotlight, BTC ETF flows, macro events, and SSI index snapshots from the Open API.",
  },
  {
    n: 2,
    title: "Analyze",
    subtitle: "Agent fuses news + flows",
    body: "The signal engine scores ETF flows, news sentiment, and sector momentum against your focus preset.",
  },
  {
    n: 3,
    title: "Signal",
    subtitle: "Ranked actionable output",
    body: "Receive confidence-scored signals with evidence links back to SoSoValue sources.",
  },
  {
    n: 4,
    title: "Match",
    subtitle: "Wallet-sized spot trade",
    body: "We read your Spot USDC balance and build the trade plan — open the match on testnet.sodex.com.",
  },
];

export function markIntroSeen() {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, "1");
  }
}

export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function OnboardingModal({
  forceOpen,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    if (!hasSeenIntro()) setOpen(true);
  }, [forceOpen]);

  if (!open) return null;

  function close() {
    markIntroSeen();
    setOpen(false);
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <h2 id="onboarding-title" className="text-xl font-semibold">
          How SignalForge works
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          One step at a time: Scan → Analyze → Signal → Match on SoDEX testnet.
        </p>
        <ol className="mt-6 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-400">
                {s.n}
              </span>
              <div>
                <p className="font-medium">
                  {s.title}{" "}
                  <span className="font-normal text-[var(--muted)]">
                    — {s.subtitle}
                  </span>
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app"
            onClick={close}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-sm font-medium text-black"
          >
            Launch app →
          </Link>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-white"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}