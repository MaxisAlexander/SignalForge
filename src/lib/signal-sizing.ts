import {
  fetchValidatedSpotPrices,
  MIN_SPOT_USD,
  spotPriceMapFromBook,
  type SpotPriceBook,
  type SpotPriceMap,
} from "./public-spot-prices";

export { MIN_SPOT_USD, type SpotPriceBook, type SpotPriceMap };

/** Testnet assumption: spot wallet ≤ this USDC for sizing */
export const DEFAULT_WALLET_USDC = 1000;

export async function fetchSpotPricesForPairs(): Promise<{
  prices: SpotPriceMap;
  book: SpotPriceBook;
}> {
  const book = await fetchValidatedSpotPrices();
  return { prices: spotPriceMapFromBook(book), book };
}

export function resolveSpotPriceUsd(
  pair: string,
  spotPrices?: SpotPriceMap,
): number {
  const fromMarket = spotPrices?.[pair];
  if (fromMarket && fromMarket >= (MIN_SPOT_USD[pair] ?? 1)) {
    return fromMarket;
  }
  return 0;
}

/** % of wallet to deploy from confidence (always ≤ wallet cap) */
export function tradeNotionalUsd(
  confidence: number,
  walletUsdc: number = DEFAULT_WALLET_USDC,
): number {
  const pct =
    confidence >= 88
      ? 0.22
      : confidence >= 82
        ? 0.18
        : confidence >= 75
          ? 0.14
          : confidence >= 68
            ? 0.1
            : 0.06;
  const raw = walletUsdc * pct;
  const min = Math.min(25, walletUsdc * 0.05);
  const max = walletUsdc * 0.85;
  return Math.round(Math.min(max, Math.max(min, raw)) * 100) / 100;
}

export function capLeverageForWallet(
  leverage: number,
  walletUsdc: number = DEFAULT_WALLET_USDC,
): 1 | 5 | 10 | 15 | 20 | 25 {
  const max =
    walletUsdc < 500 ? 5 : walletUsdc <= 1000 ? 10 : walletUsdc <= 3000 ? 15 : 25;
  const opts = [1, 5, 10, 15, 20, 25] as const;
  const picked = opts.filter((x) => x <= leverage).pop() ?? 1;
  return (Math.min(picked, max) as 1 | 5 | 10 | 15 | 20 | 25) || 1;
}

export function formatUsdPrice(px: number): string {
  if (px >= 1000) return px.toFixed(2);
  if (px >= 1) return px.toFixed(4);
  return px.toFixed(6);
}

export function planNotionalUsd(
  amount: string,
  amountUnit: "BTC" | "USDC",
  priceUsd: number,
): number {
  const n = parseFloat(amount) || 0;
  if (amountUnit === "USDC") return n;
  return n * priceUsd;
}