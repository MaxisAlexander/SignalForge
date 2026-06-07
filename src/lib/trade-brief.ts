import type { OrderDraft, OrderSide, OrderType, SpotSymbolMeta } from "./signal-order";

export type AllocationPct = 0 | 25 | 50 | 75 | 100;

export interface PairInfo {
  label: string;
  baseCoin: string;
  quoteCoin: string;
  market: "Spot";
}

export interface WalletAnalysis {
  connected: boolean;
  spendCoin: string;
  spendAvailable: number;
  spendUsd: number;
  receiveCoin: string;
  receiveAvailable: number;
  canTrade: boolean;
  note: string;
  balanceLines: { coin: string; available: number; usdApprox: number }[];
}

export interface TradeOpenWindow {
  openBy: Date;
  validMinutes: number;
  urgency: "high" | "medium" | "low";
  label: string;
}

export interface TradeInstruction {
  pair: PairInfo;
  side: OrderSide;
  orderType: OrderType;
  tradeUsd: number;
  quantity: string;
  quantityCoin: string;
  limitPrice?: string;
  window: TradeOpenWindow;
  /** Sized to full wallet balance available for this side */
  matchedToWallet: boolean;
}

function stripV(coin: string | undefined | null): string {
  if (coin == null || coin === "") return "";
  return String(coin).replace(/^v/i, "");
}

export function normalizeBalances(
  rows: { coin?: string; available?: string; [key: string]: unknown }[],
): { coin: string; available: string }[] {
  return rows
    .map((b) => {
      const coin = String(
        b.coin ?? b.Coin ?? b.asset ?? b.currency ?? b.symbol ?? "",
      ).trim();
      const available = String(
        b.available ?? b.Available ?? b.free ?? b.balance ?? b.qty ?? "0",
      );
      return { coin, available };
    })
    .filter((b) => b.coin.length > 0);
}

export function pairFromSymbol(symbol: string, displayName?: string): PairInfo {
  const [rawBase = "BTC", rawQuote = "USDC"] = (symbol || "vBTC_vUSDC").split("_");
  const base = stripV(rawBase) || "BTC";
  const quote = stripV(rawQuote) || "USDC";
  const label =
    displayName?.includes("/") ? displayName : `${base}/${quote}`;
  return {
    label,
    baseCoin: rawBase.startsWith("v") ? rawBase : `v${rawBase}`,
    quoteCoin: rawQuote.startsWith("v") ? rawQuote : `v${rawQuote}`,
    market: "Spot",
  };
}

function balanceUsd(
  coin: string | undefined,
  amount: number,
  lastPx: number,
  baseCoin: string,
  quoteCoin: string,
): number {
  const c = coin ?? "";
  if (c === quoteCoin || stripV(c) === "USDC") return amount;
  if (c === baseCoin) return amount * lastPx;
  return amount;
}

/** Sum Spot USDC (vUSDC, USDC) — includes faucet-funded balance once on Spot */
export function totalQuoteUsd(
  balances: { coin?: string; available?: string; [key: string]: unknown }[],
): number {
  return normalizeBalances(balances)
    .filter((b) => stripV(b.coin) === "USDC")
    .reduce((s, b) => s + (parseFloat(b.available) || 0), 0);
}

export function analyzeWallet(
  balances: { coin?: string; available?: string; [key: string]: unknown }[],
  side: OrderSide,
  pair: PairInfo,
  lastPx: number,
): WalletAnalysis {
  const parsed = normalizeBalances(balances).map((b) => ({
    coin: b.coin,
    available: parseFloat(b.available) || 0,
  }));

  const spendCoin = side === "BUY" ? pair.quoteCoin : pair.baseCoin;
  const receiveCoin = side === "BUY" ? pair.baseCoin : pair.quoteCoin;
  const spend = parsed.find((b) => b.coin === spendCoin);
  const receive = parsed.find((b) => b.coin === receiveCoin);
  let spendAvailable = spend?.available ?? 0;
  if (side === "BUY") {
    const usdcTotal = totalQuoteUsd(balances);
    if (usdcTotal > spendAvailable) spendAvailable = usdcTotal;
  }
  const receiveAvailable = receive?.available ?? 0;
  const spendUsd = balanceUsd(
    spendCoin,
    spendAvailable,
    lastPx,
    pair.baseCoin,
    pair.quoteCoin,
  );

  const balanceLines = parsed
    .filter((b) => b.available > 0)
    .map((b) => ({
      coin: b.coin,
      available: b.available,
      usdApprox: balanceUsd(b.coin, b.available, lastPx, pair.baseCoin, pair.quoteCoin),
    }))
    .sort((a, b) => b.usdApprox - a.usdApprox);

  let note = "";
  const canTrade = spendAvailable > 0 && spendUsd > 0;
  if (!canTrade) {
    note =
      side === "BUY"
        ? `Need ${stripV(pair.quoteCoin)} in Spot (transfer from EVM or faucet).`
        : `Need ${stripV(pair.baseCoin)} in Spot to sell.`;
  } else {
    note = `Using ${stripV(spendCoin)} balance for this ${side} spot order.`;
  }

  return {
    connected: true,
    spendCoin,
    spendAvailable,
    spendUsd,
    receiveCoin,
    receiveAvailable,
    canTrade,
    note,
    balanceLines,
  };
}

function roundToStep(value: number, step: string): string {
  const s = parseFloat(step);
  if (!s || s <= 0) return value.toFixed(8);
  const decimals = step.includes(".") ? step.split(".")[1]?.length ?? 0 : 0;
  const n = Math.floor(value / s) * s;
  if (n <= 0) return s.toFixed(decimals);
  return n.toFixed(decimals);
}

export function tradeOpenWindow(confidence: number): TradeOpenWindow {
  const validMinutes = confidence >= 80 ? 15 : confidence >= 60 ? 30 : 45;
  const openBy = new Date(Date.now() + validMinutes * 60 * 1000);
  const urgency: TradeOpenWindow["urgency"] =
    confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low";
  const label = openBy.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return { openBy, validMinutes, urgency, label };
}

export function sizeFromAllocation(
  allocationPct: AllocationPct,
  spendUsd: number,
  lastPx: number,
  meta: SpotSymbolMeta,
  signalNotionalUsd: string | number,
  side: OrderSide,
): { tradeUsd: number; quantity: string; quantityCoin: string } {
  const minNotional = parseFloat(meta.minNotional) || 5;
  const minQty = parseFloat(meta.minQuantity) || 0.00001;
  const px = Math.max(lastPx, 1);

  let tradeUsd: number;
  if (allocationPct === 0) {
    tradeUsd = Math.max(
      minNotional,
      parseFloat(String(signalNotionalUsd)) || minNotional,
    );
  } else {
    const fromWallet = spendUsd * (allocationPct / 100);
    tradeUsd = Math.max(minNotional, fromWallet);
  }
  if (spendUsd > 0) tradeUsd = Math.min(tradeUsd, spendUsd);

  const rawQty =
    side === "BUY"
      ? Math.max(minQty, tradeUsd / px)
      : Math.max(minQty, tradeUsd / px);
  const quantity = roundToStep(rawQty, meta.stepSize);
  const basePart = meta.name?.split("_")[0] ?? "BTC";
  const quantityCoin = stripV(basePart) || "BTC";

  return { tradeUsd, quantity, quantityCoin };
}

/** Platform match plan: use full wallet balance for the trade side, else signal minimum */
export function buildMatchPlan(
  draft: OrderDraft,
  meta: SpotSymbolMeta,
  lastPx: number,
  wallet: WalletAnalysis | null,
): TradeInstruction {
  const pair = pairFromSymbol(draft.symbol, draft.displayName);
  const spendUsd = wallet?.spendUsd ?? 0;
  const matched = spendUsd > 0 && (wallet?.canTrade ?? false);
  const sized = sizeFromAllocation(
    matched ? 100 : 0,
    spendUsd,
    lastPx,
    meta,
    draft.notionalUsd,
    draft.side,
  );

  return {
    pair,
    side: draft.side,
    orderType: draft.type,
    tradeUsd: sized.tradeUsd,
    quantity: sized.quantity,
    quantityCoin: sized.quantityCoin,
    limitPrice: draft.type === "LIMIT" ? draft.price : undefined,
    window: tradeOpenWindow(draft.confidence),
    matchedToWallet: matched,
  };
}

export function formatTradeClipboard(instr: TradeInstruction): string {
  const lines = [
    "=== SignalForge match ===",
    `Token pair: ${instr.pair.label}`,
    `Market: ${instr.pair.market}`,
    `Side: ${instr.side}`,
    `Order type: ${instr.orderType}`,
    `Amount: $${instr.tradeUsd.toFixed(2)} USD (~${instr.quantity} ${instr.quantityCoin})`,
    `Open trade by: ${instr.window.label} (${instr.window.validMinutes} min window)`,
  ];
  if (instr.limitPrice) lines.push(`Limit price: ${instr.limitPrice}`);
  return lines.join("\n");
}