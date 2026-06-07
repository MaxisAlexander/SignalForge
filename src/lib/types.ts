export type SignalDirection = "bullish" | "bearish" | "neutral" | "watch";
export type MarginMode = "cross" | "isolated";
export type FuturesLeverage = 1 | 5 | 10 | 15 | 20 | 25;
export type PositionSide = "long" | "short";
export type AmountUnit = "BTC" | "USDC";

export interface SpotSignalPlan {
  pair: string;
  market: "Spot";
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  amount: string;
  amountUnit: AmountUnit;
  notionalUsd: string;
  /** Entry / limit price in USD (USDC quote) */
  priceUsdc: string;
}

export interface FuturesSignalPlan {
  pair: string;
  market: "Futures";
  marginMode: MarginMode;
  leverage: FuturesLeverage;
  positionSide: PositionSide;
  sideLabel: "Buy / Long" | "Sell / Short";
  orderType: "LIMIT";
  amount: string;
  amountUnit: AmountUnit;
  /** Limit entry price in USD (USDC quote) — paste into SoDEX */
  priceUsdc: string;
  reduceOnly: boolean;
  takeProfitPct: number;
  stopLossPct: number;
  takeProfitPrice: string;
  stopLossPrice: string;
}

export interface EvidenceItem {
  source: string;
  label: string;
  value: string;
  url?: string;
}

export interface SignalVerification {
  verified: boolean;
  score: number;
  dataSourceCount: number;
  checksPassed: number;
  checksTotal: number;
  summary: string;
}

export interface TradeSignal {
  id: string;
  direction: SignalDirection;
  confidence: number;
  verification: SignalVerification;
  title: string;
  summary: string;
  rationale: string[];
  evidence: EvidenceItem[];
  recommendedAction: {
    type: "ssi" | "sector" | "risk_off" | "watch";
    label: string;
    detail: string;
    ssiTicker?: string;
  };
  executionSteps: string[];
  spot: SpotSignalPlan;
  futures: FuturesSignalPlan;
}

/** Built by signal engine before enrichSignal attaches spot + futures plans */
export type TradeSignalDraft = Omit<TradeSignal, "spot" | "futures">;

export interface HotNewsItem {
  id: string;
  title: string;
  content: string;
  source_link: string;
  release_time: string;
}

export interface SectorItem {
  name: string;
  change_pct_24h: number;
  marketcap_dom?: number;
}

export interface SpotlightItem {
  name: string;
  change_pct_24h: number;
}

export interface IndexSnapshot {
  ticker: string;
  price: number;
  change_pct_24h: number;
  roi_7d?: number;
  roi_1m?: number;
}

export interface EtfFlowPoint {
  date: string;
  total_net_inflow: number;
}

export interface MacroDay {
  date: string;
  events: string[];
}

export interface MarketPulse {
  fetchedAt: string;
  sectors: SectorItem[];
  spotlight: SpotlightItem[];
  hotNews: HotNewsItem[];
  featuredNews: HotNewsItem[];
  macroEvents: MacroDay[];
  indices: IndexSnapshot[];
  etfBtc: EtfFlowPoint[];
  apiModulesUsed: string[];
  /** Non-fatal issues (e.g. rate limits on optional modules). */
  warnings?: string[];
}

export interface AnalysisResult {
  focus: string;
  /** ISO timestamp when this analysis run completed (never reused from cache). */
  analyzedAt: string;
  signals: TradeSignal[];
  workflow: {
    scan: string;
    analyze: string;
    signal: string;
    match: string;
  };
  pulse: MarketPulse;
}

export type WorkflowStep = "scan" | "analyze" | "signal" | "match";

export type FocusPreset =
  | "btc-macro"
  | "ai-sector"
  | "defi-rotation"
  | "risk-off"
  | "custom";