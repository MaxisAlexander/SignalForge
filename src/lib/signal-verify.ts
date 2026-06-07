import {
  MIN_SPOT_USD,
  planNotionalUsd,
  resolveSpotPriceUsd,
  type SpotPriceBook,
  type SpotPriceMap,
} from "./signal-sizing";
import type { MarketPulse, TradeSignal, TradeSignalDraft } from "./types";

export interface VerificationResult {
  verified: boolean;
  score: number;
  dataSourceCount: number;
  checksPassed: number;
  checksTotal: number;
  summary: string;
}

function check(passed: boolean, detail: string) {
  return { passed, detail };
}

function pairForSignal(signal: TradeSignalDraft): string {
  const ticker = signal.recommendedAction.ssiTicker;
  if (ticker === "ssiAI") return "ETH/USDC";
  if (ticker === "ssiDeFi") return "UNI/USDC";
  return "BTC/USDC";
}

export function verifySignalDraft(
  signal: TradeSignalDraft,
  pulse: MarketPulse,
  spotPriceBook?: SpotPriceBook,
): VerificationResult {
  const checks: { passed: boolean; detail: string }[] = [];
  const sources = new Set(signal.evidence.map((e) => e.source));

  checks.push(
    check(
      signal.evidence.length >= 2,
      `${signal.evidence.length} evidence points (min 2)`,
    ),
  );
  checks.push(
    check(
      signal.confidence >= 65,
      `Confidence ${signal.confidence}% (min 65%)`,
    ),
  );
  checks.push(
    check(
      signal.direction !== "neutral",
      "Direction resolved from data (not neutral)",
    ),
  );

  if (signal.id === "etf-btc-flow") {
    const latest = pulse.etfBtc[0];
    const prev = pulse.etfBtc[1];
    const inflowM = latest ? Math.abs(latest.total_net_inflow / 1e6) : 0;
    checks.push(check(!!latest?.date, "ETF flow date present"));
    checks.push(check(inflowM >= 5, `Flow magnitude $${inflowM.toFixed(1)}M (min $5M)`));
    if (prev) {
      checks.push(
        check(
          Math.sign(prev.total_net_inflow) === Math.sign(latest!.total_net_inflow),
          "2-day flow direction confirmed",
        ),
      );
    }
  }

  if (signal.id === "sector-rotation") {
    const leader = [...pulse.sectors].sort(
      (a, b) => b.change_pct_24h - a.change_pct_24h,
    )[0];
    const laggard = [...pulse.sectors].sort(
      (a, b) => a.change_pct_24h - b.change_pct_24h,
    )[0];
    const spread =
      ((leader?.change_pct_24h ?? 0) - (laggard?.change_pct_24h ?? 0)) * 100;
    checks.push(check(pulse.sectors.length >= 4, `${pulse.sectors.length} sectors loaded`));
    checks.push(check(spread >= 1.5, `Leader/laggard spread ${spread.toFixed(2)}% (min 1.5%)`));
    checks.push(
      check(!!signal.recommendedAction.ssiTicker, "Leader mapped to SSI index"),
    );
  }

  if (signal.id === "news-sentiment") {
    const bear = signal.evidence.filter((e) => e.label === "bearish").length;
    const bull = signal.evidence.filter((e) => e.label === "bullish").length;
    checks.push(check(signal.evidence.length >= 3, `${signal.evidence.length} tagged headlines (min 3)`));
    checks.push(
      check(
        signal.direction === "bullish" ? bull >= 2 : bear >= 2,
        "Majority tone matches signal direction",
      ),
    );
  }

  if (signal.id.startsWith("index-")) {
    const ticker = signal.recommendedAction.ssiTicker;
    const idx = pulse.indices.find((i) => i.ticker === ticker);
    const chg = Math.abs((idx?.change_pct_24h ?? 0) * 100);
    checks.push(check(!!idx && idx.price > 0, "SSI index snapshot from SoSoValue"));
    checks.push(check(chg >= 0.5, `24h move ${chg.toFixed(2)}% (min 0.5%)`));
  }

  const pair = pairForSignal(signal);
  const live = spotPriceBook?.[pair];
  if (live) {
    const min = MIN_SPOT_USD[pair] ?? 1;
    checks.push(
      check(
        live.usd >= min,
        `Live ${pair} $${live.usd.toLocaleString()} (${live.sources.join(" + ")})`,
      ),
    );
    if (pair === "BTC/USDC") {
      checks.push(
        check(
          live.sources.length >= 2,
          "BTC spot cross-checked on CoinGecko + Binance",
        ),
      );
    } else {
      checks.push(
        check(
          live.sources.length >= 1,
          `Spot validated via ${live.sources.join(" + ")}`,
        ),
      );
    }
  } else {
    checks.push(check(false, `Live ${pair} spot price not validated`));
  }

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const verified = passed === total;
  const score = Math.round((passed / total) * 100);

  return {
    verified,
    score,
    dataSourceCount: sources.size,
    checksPassed: passed,
    checksTotal: total,
    summary: verified
      ? `Verified — ${passed}/${total} data checks · ${sources.size} SoSoValue sources`
      : `Failed verification — ${passed}/${total} checks`,
  };
}

export function attachVerification(
  draft: TradeSignalDraft,
  pulse: MarketPulse,
  spotPriceBook?: SpotPriceBook,
): TradeSignalDraft | null {
  const verification = verifySignalDraft(draft, pulse, spotPriceBook);
  if (!verification.verified) return null;
  return { ...draft, verification };
}

/** Final gate: trade size must fit testnet wallet cap */
const MAX_ENTRY_VS_ORACLE_PCT = 1.5;

export function verifyPlanSizing(
  signal: TradeSignal,
  walletUsdc: number,
  spotPrices?: SpotPriceMap,
): boolean {
  const pair = signal.spot?.pair ?? signal.futures?.pair ?? "BTC/USDC";
  const px = resolveSpotPriceUsd(pair, spotPrices);
  if (px <= 0) return false;

  const spotN = parseFloat(signal.spot.notionalUsd);
  if (spotN <= 0 || spotN > walletUsdc) return false;

  const futN = planNotionalUsd(
    signal.futures.amount,
    signal.futures.amountUnit,
    px,
  );
  if (futN <= 0 || futN > walletUsdc) return false;

  const tp = parseFloat(signal.futures.takeProfitPrice);
  const sl = parseFloat(signal.futures.stopLossPrice);
  const entry = parseFloat(signal.futures.priceUsdc);
  const spotEntry = parseFloat(signal.spot.priceUsdc);
  const min = MIN_SPOT_USD[pair] ?? 1;
  if (entry < min || spotEntry < min) return false;

  const ref = Math.max(entry, spotEntry);
  const driftPct = (Math.abs(ref - px) / px) * 100;
  if (driftPct > MAX_ENTRY_VS_ORACLE_PCT) return false;

  if (tp <= 0 || sl <= 0) return false;

  return true;
}