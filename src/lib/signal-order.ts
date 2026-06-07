import type { TradeSignal } from "./types";

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT";

/** SoDEX spot TimeInForceEnum: GTC=1, FOK=2, IOC=3, GTX=4 */
export const TIF_GTC = 1;
export const TIF_IOC = 3;

export interface SpotSymbolMeta {
  id: number;
  name: string;
  displayName: string;
  pricePrecision: number;
  tickSize: string;
  stepSize: string;
  minQuantity: string;
  minNotional: string;
}

export interface OrderDraft {
  symbol: string;
  symbolID: number;
  displayName: string;
  side: OrderSide;
  sideCode: 1 | 2;
  type: OrderType;
  typeCode: 1 | 2;
  timeInForceCode: number;
  timeInForceLabel: string;
  price: string;
  quantity: string;
  notionalUsd: string;
  clOrdID: string;
  thesis: string;
  evidenceSummary: string[];
  confidence: number;
  signalTitle: string;
  actionLabel: string;
}

function roundToStep(value: number, step: string): string {
  const s = parseFloat(step);
  if (!s || s <= 0) return value.toFixed(8);
  const decimals = step.includes(".") ? step.split(".")[1]?.length ?? 0 : 0;
  const n = Math.ceil(value / s) * s;
  return n.toFixed(decimals);
}

export function buildOrderDraft(
  signal: TradeSignal,
  symbolMeta: SpotSymbolMeta,
  lastPx: number,
  bidPx: number,
  askPx: number,
): OrderDraft {
  const side: OrderSide =
    signal.direction === "bearish" || signal.recommendedAction.type === "risk_off"
      ? "SELL"
      : "BUY";

  const minNotional = parseFloat(symbolMeta.minNotional) || 5;
  const minQty = parseFloat(symbolMeta.minQuantity) || 0.00001;
  const px = lastPx > 0 ? lastPx : side === "BUY" ? askPx : bidPx;
  const rawQty = Math.max(minQty, minNotional / Math.max(px, 1));
  const quantity = roundToStep(rawQty, symbolMeta.stepSize);

  const useLimit = signal.confidence >= 80;
  const limitPrice =
    side === "BUY"
      ? roundToStep(askPx || px, symbolMeta.tickSize)
      : roundToStep(bidPx || px, symbolMeta.tickSize);

  const notional = (parseFloat(quantity) * px).toFixed(2);
  const timeInForceCode = useLimit ? TIF_GTC : TIF_IOC;
  const timeInForceLabel = useLimit ? "GTC" : "IOC";

  return {
    symbol: symbolMeta.name,
    symbolID: symbolMeta.id,
    displayName: symbolMeta.displayName,
    side,
    sideCode: side === "BUY" ? 1 : 2,
    type: useLimit ? "LIMIT" : "MARKET",
    typeCode: useLimit ? 1 : 2,
    timeInForceCode,
    timeInForceLabel,
    price: limitPrice,
    quantity,
    notionalUsd: notional,
    clOrdID: `sf-${signal.id}-${Date.now()}`.slice(0, 36),
    thesis: signal.summary,
    evidenceSummary: signal.evidence.slice(0, 4).map((e) => `${e.label}: ${e.value}`),
    confidence: signal.confidence,
    signalTitle: signal.title,
    actionLabel: signal.recommendedAction.label,
  };
}