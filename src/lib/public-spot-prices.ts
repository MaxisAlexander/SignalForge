/**
 * Live spot USD prices from public APIs (no API key).
 * Signals are only sized when two sources agree within tolerance.
 */

export interface SpotPriceEntry {
  usd: number;
  sources: string[];
  fetchedAt: string;
}

export type SpotPriceBook = Record<string, SpotPriceEntry>;

const PAIR_ASSETS: Record<
  string,
  { coingeckoId: string; binanceSymbol: string }
> = {
  "BTC/USDC": { coingeckoId: "bitcoin", binanceSymbol: "BTCUSDT" },
  "ETH/USDC": { coingeckoId: "ethereum", binanceSymbol: "ETHUSDT" },
  "UNI/USDC": { coingeckoId: "uniswap", binanceSymbol: "UNIUSDT" },
};

/** Minimum plausible USD spot (rejects SSI index NAV mistaken for BTC). */
export const MIN_SPOT_USD: Record<string, number> = {
  "BTC/USDC": 1000,
  "ETH/USDC": 50,
  "UNI/USDC": 0.1,
};

/** Max % difference between CoinGecko and Binance before we reject the pair. */
const MAX_DIVERGENCE_PCT = 2;

const FETCH_OPTS: RequestInit = { cache: "no-store" };

async function fetchCoinGeckoUsd(): Promise<Record<string, number>> {
  const ids = Object.values(PAIR_ASSETS)
    .map((a) => a.coingeckoId)
    .join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const out: Record<string, number> = {};
  for (const [pair, { coingeckoId }] of Object.entries(PAIR_ASSETS)) {
    const px = json[coingeckoId]?.usd;
    if (typeof px === "number" && px > 0) out[pair] = px;
  }
  return out;
}

async function fetchBinanceUsd(): Promise<Record<string, number>> {
  const symbols = Object.values(PAIR_ASSETS).map((a) => a.binanceSymbol);
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const rows = (await res.json()) as { symbol: string; price: string }[];
  const bySym = new Map(rows.map((r) => [r.symbol, parseFloat(r.price)]));
  const out: Record<string, number> = {};
  for (const [pair, { binanceSymbol }] of Object.entries(PAIR_ASSETS)) {
    const px = bySym.get(binanceSymbol);
    if (typeof px === "number" && px > 0) out[pair] = px;
  }
  return out;
}

function withinBand(a: number, b: number, maxPct: number): boolean {
  const mid = (a + b) / 2;
  if (mid <= 0) return false;
  return (Math.abs(a - b) / mid) * 100 <= maxPct;
}

function mergePair(
  pair: string,
  fetchedAt: string,
  cg?: number,
  bin?: number,
): SpotPriceEntry | null {
  const min = MIN_SPOT_USD[pair] ?? 0.01;

  if (cg != null && bin != null) {
    if (!withinBand(cg, bin, MAX_DIVERGENCE_PCT)) return null;
    const usd = Math.round(((cg + bin) / 2) * 100) / 100;
    if (usd < min) return null;
    return {
      usd,
      sources: ["CoinGecko", "Binance"],
      fetchedAt,
    };
  }

  const single = cg ?? bin;
  if (single == null || single < min) return null;
  return {
    usd: Math.round(single * 100) / 100,
    sources: [cg != null ? "CoinGecko" : "Binance"],
    fetchedAt,
  };
}

export type SpotPriceMap = Record<string, number>;

export function spotPriceMapFromBook(book: SpotPriceBook): SpotPriceMap {
  const out: SpotPriceMap = {};
  for (const [pair, entry] of Object.entries(book)) {
    out[pair] = entry.usd;
  }
  return out;
}

export async function fetchValidatedSpotPrices(): Promise<SpotPriceBook> {
  const fetchedAt = new Date().toISOString();
  let cg: Record<string, number> = {};
  let bin: Record<string, number> = {};

  const [cgResult, binResult] = await Promise.allSettled([
    fetchCoinGeckoUsd(),
    fetchBinanceUsd(),
  ]);

  if (cgResult.status === "fulfilled") cg = cgResult.value;
  if (binResult.status === "fulfilled") bin = binResult.value;

  if (!Object.keys(cg).length && !Object.keys(bin).length) {
    throw new Error(
      "Could not fetch live spot prices from public APIs (CoinGecko / Binance).",
    );
  }

  const book: SpotPriceBook = {};
  for (const pair of Object.keys(PAIR_ASSETS)) {
    const entry = mergePair(pair, fetchedAt, cg[pair], bin[pair]);
    if (entry) book[pair] = entry;
  }

  if (!book["BTC/USDC"]) {
    throw new Error(
      "BTC/USDC live price unavailable or sources diverged — signals not generated.",
    );
  }

  return book;
}

export function formatPriceBookSummary(book: SpotPriceBook): string {
  const btc = book["BTC/USDC"];
  if (!btc) return "No validated prices";
  return `BTC $${btc.usd.toLocaleString()} (${btc.sources.join(" + ")})`;
}