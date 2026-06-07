const TESTNET_SPOT = "https://testnet-gw.sodex.dev/api/v1/spot";

export const SODEX_TESTNET_FAUCET_URL = "https://testnet.sodex.com/faucet";
export const SODEX_TESTNET_SETTINGS_URL = "https://testnet.sodex.com/";

const SSI_TO_SYMBOL: Record<string, string> = {
  ssiMAG7: "vBTC_vUSDC",
  ssiMeme: "vMEMEssi_vUSDC",
  ssiAI: "vMAG7ssi_vUSDC",
  ssiDeFi: "vUNI_vUSDC",
  ssiLayer1: "vETH_vUSDC",
  ssiRWA: "vXAUt_vUSDC",
};

export function symbolForSignal(ssiTicker?: string): string {
  if (ssiTicker && SSI_TO_SYMBOL[ssiTicker]) return SSI_TO_SYMBOL[ssiTicker];
  return "vBTC_vUSDC";
}

export interface TestnetTicker {
  symbol: string;
  lastPx: string;
  changePct: number;
  bidPx: string;
  askPx: string;
}

export interface SpotSymbolRaw {
  id: number;
  name: string;
  displayName: string;
  pricePrecision: number;
  tickSize: string;
  minQuantity: string;
  minNotional: string;
  stepSize: string;
}

export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export async function fetchTestnetTicker(symbol: string): Promise<TestnetTicker> {
  const url = `${TESTNET_SPOT}/markets/tickers?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`SoDEX testnet HTTP ${res.status}`);
  const json = (await res.json()) as { code: number; data: TestnetTicker[] };
  if (json.code !== 0 || !json.data?.[0]) {
    throw new Error("Ticker not found on SoDEX testnet");
  }
  return json.data[0];
}

export async function fetchSpotSymbol(symbol: string): Promise<SpotSymbolRaw> {
  const url = `${TESTNET_SPOT}/markets/symbols?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Symbol HTTP ${res.status}`);
  const json = (await res.json()) as { code: number; data: SpotSymbolRaw[] };
  if (json.code !== 0 || !json.data?.[0]) throw new Error("Symbol not found");
  return json.data[0];
}

export async function fetchOrderBook(
  symbol: string,
  limit = 8,
): Promise<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }> {
  const url = `${TESTNET_SPOT}/markets/${encodeURIComponent(symbol)}/orderbook?limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error(`Orderbook HTTP ${res.status}`);
  const json = (await res.json()) as {
    code: number;
    data: { bids: [string, string][]; asks: [string, string][] };
  };
  if (json.code !== 0) throw new Error("Orderbook unavailable");
  const map = (rows: [string, string][]) =>
    rows.map(([price, quantity]) => ({ price, quantity }));
  return { bids: map(json.data.bids ?? []), asks: map(json.data.asks ?? []) };
}

export async function fetchAccountState(address: string): Promise<{
  accountID: number;
  needsActivation: boolean;
  hasBalances: boolean;
  balances: { coin: string; available: string }[];
}> {
  const url = `${TESTNET_SPOT}/accounts/${address}/state`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Account state HTTP ${res.status}`);
  const json = (await res.json()) as {
    code: number;
    data: {
      aid?: number;
      accountID?: number;
      B?: Record<string, unknown>[];
    };
  };
  if (json.code !== 0) throw new Error("Account state unavailable");
  const d = json.data;
  const accountID = Number(d.aid ?? d.accountID ?? 0);
  const rawBalances = d.B ?? [];
  const balances = rawBalances
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
  const hasBalances = balances.some(
    (b) => parseFloat(b.available) > 0,
  );
  return {
    accountID,
    /** aid=0 until user claims faucet + transfers to Spot on testnet.sodex.com */
    needsActivation: accountID <= 0,
    hasBalances,
    balances,
  };
}

export async function submitSpotOrder(
  params: Record<string, unknown>,
  headers: { apiKey?: string; sign: string; nonce: string },
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Sign": headers.sign,
    "X-API-Nonce": headers.nonce,
  };
  if (headers.apiKey) reqHeaders["X-API-Key"] = headers.apiKey;

  const res = await fetch(`${TESTNET_SPOT}/trade/orders/batch`, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify(params),
  });
  const text = await res.text();
  let json: { code: number; message?: string; error?: string; data?: unknown };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return {
      ok: false,
      error: `SoDEX returned non-JSON (HTTP ${res.status}). Check wallet signature and testnet status.`,
    };
  }
  if (json.code !== 0) {
    return {
      ok: false,
      error: json.message ?? json.error ?? `Order rejected (code ${json.code})`,
    };
  }
  return { ok: true, data: json.data };
}