import type {
  FuturesLeverage,
  FuturesSignalPlan,
  MarginMode,
  PositionSide,
  SignalDirection,
  SpotSignalPlan,
  TradeSignal,
  TradeSignalDraft,
} from "./types";
import {
  DEFAULT_WALLET_USDC,
  capLeverageForWallet,
  formatUsdPrice,
  resolveSpotPriceUsd,
  tradeNotionalUsd,
  type SpotPriceBook,
  type SpotPriceMap,
} from "./signal-sizing";

export interface PlanContext {
  spotPrices?: SpotPriceMap;
  spotPriceBook?: SpotPriceBook;
  walletUsdc?: number;
}

function resolvePair(signal: TradeSignalDraft): string {
  const ticker = signal.recommendedAction.ssiTicker;
  if (ticker === "ssiMAG7" || signal.id.includes("etf") || signal.id.includes("news")) {
    return "BTC/USDC";
  }
  if (ticker === "ssiAI") return "ETH/USDC";
  if (ticker === "ssiDeFi") return "UNI/USDC";
  return "BTC/USDC";
}

function spotSide(signal: TradeSignalDraft): "BUY" | "SELL" {
  if (signal.direction === "bearish" || signal.recommendedAction.type === "risk_off") {
    return "SELL";
  }
  return "BUY";
}

function positionSide(signal: TradeSignalDraft): PositionSide {
  if (signal.direction === "bearish" || signal.recommendedAction.type === "risk_off") {
    return "short";
  }
  return "long";
}

function pickLeverage(
  confidence: number,
  direction: SignalDirection,
  walletUsdc: number,
): FuturesLeverage {
  if (direction === "watch" || direction === "neutral") return 1;
  let lev: FuturesLeverage = 1;
  if (confidence >= 88) lev = 10;
  else if (confidence >= 82) lev = 10;
  else if (confidence >= 76) lev = 5;
  else if (confidence >= 70) lev = 5;
  else if (confidence >= 62) lev = 1;
  return capLeverageForWallet(lev, walletUsdc);
}

function pickMarginMode(signal: TradeSignalDraft): MarginMode {
  if (signal.recommendedAction.type === "risk_off") return "isolated";
  if (signal.id.includes("etf") || signal.id.includes("index")) return "cross";
  return signal.confidence >= 72 ? "cross" : "isolated";
}

function pickTpSlPct(confidence: number): { tp: number; sl: number } {
  const tp = Math.min(8, Math.max(3, Math.round(confidence / 12)));
  const sl = Math.min(4, Math.max(1.5, tp / 2));
  return { tp, sl };
}

function pickReduceOnly(signal: TradeSignalDraft, pos: PositionSide): boolean {
  if (signal.recommendedAction.type === "risk_off") return pos === "long";
  return signal.direction === "bearish" && signal.confidence < 70;
}

export function buildSpotPlan(
  signal: TradeSignalDraft,
  ctx: PlanContext = {},
): SpotSignalPlan | null {
  const wallet = ctx.walletUsdc ?? DEFAULT_WALLET_USDC;
  const pair = resolvePair(signal);
  const px = resolveSpotPriceUsd(pair, ctx.spotPrices);
  if (px <= 0) return null;

  const side = spotSide(signal);
  const notional = tradeNotionalUsd(signal.confidence, wallet);
  const useLimit = signal.confidence >= 75;
  const entryPx = side === "BUY" ? px * 1.0005 : px * 0.9995;

  const amountUnit: SpotSignalPlan["amountUnit"] = side === "BUY" ? "USDC" : "BTC";
  const amount =
    amountUnit === "USDC"
      ? notional.toFixed(2)
      : (notional / px).toFixed(6);

  return {
    pair,
    market: "Spot",
    side,
    orderType: useLimit ? "LIMIT" : "MARKET",
    amount,
    amountUnit,
    notionalUsd: notional.toFixed(2),
    priceUsdc: formatUsdPrice(useLimit ? entryPx : px),
  };
}

export function buildFuturesPlan(
  signal: TradeSignalDraft,
  ctx: PlanContext = {},
): FuturesSignalPlan | null {
  const wallet = ctx.walletUsdc ?? DEFAULT_WALLET_USDC;
  const pair = resolvePair(signal);
  const px = resolveSpotPriceUsd(pair, ctx.spotPrices);
  if (px <= 0) return null;

  const pos = positionSide(signal);
  const notional = tradeNotionalUsd(signal.confidence, wallet);
  const leverage = pickLeverage(signal.confidence, signal.direction, wallet);
  const marginMode = pickMarginMode(signal);
  const { tp, sl } = pickTpSlPct(signal.confidence);

  const refPx = pos === "long" ? px * 0.9995 : px * 1.0005;
  const takeProfitPrice = formatUsdPrice(
    pos === "long" ? refPx * (1 + tp / 100) : refPx * (1 - tp / 100),
  );
  const stopLossPrice = formatUsdPrice(
    pos === "long" ? refPx * (1 - sl / 100) : refPx * (1 + sl / 100),
  );

  /** Under $1000 wallet: show USDC margin size (clearer than huge BTC qty from wrong index price) */
  const amountUnit: FuturesSignalPlan["amountUnit"] = "USDC";
  const amount = notional.toFixed(2);

  return {
    pair,
    market: "Futures",
    marginMode,
    leverage,
    positionSide: pos,
    sideLabel: pos === "long" ? "Buy / Long" : "Sell / Short",
    orderType: "LIMIT",
    amount,
    amountUnit,
    priceUsdc: formatUsdPrice(refPx),
    reduceOnly: pickReduceOnly(signal, pos),
    takeProfitPct: tp,
    stopLossPct: sl,
    takeProfitPrice,
    stopLossPrice,
  };
}

export function enrichSignal(
  signal: TradeSignalDraft | TradeSignal,
  ctx: PlanContext = {},
): TradeSignal | null {
  const spot = buildSpotPlan(signal, ctx);
  const futures = buildFuturesPlan(signal, ctx);
  if (!spot || !futures) return null;
  return { ...signal, spot, futures };
}