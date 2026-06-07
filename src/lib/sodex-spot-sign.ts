import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const SPOT_DOMAIN = {
  name: "spot",
  version: "1",
  chainId: BigInt(138565),
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
} as const;

export const SPOT_SIGN_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  ExchangeAction: [
    { name: "payloadHash", type: "bytes32" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

export interface SpotOrderItem {
  symbolID: number;
  clOrdID: string;
  side: 1 | 2;
  type: 1 | 2;
  timeInForce: number;
  quantity: string;
  price?: string;
}

export function buildCompactPayload(
  accountID: number,
  orders: SpotOrderItem[],
): string {
  const ordersStr = orders
    .map((o) => {
      let s = `{"symbolID":${o.symbolID},"clOrdID":"${o.clOrdID}","side":${o.side},"type":${o.type},"timeInForce":${o.timeInForce},"quantity":"${o.quantity}"`;
      if (o.price != null && o.price !== "") s += `,"price":"${o.price}"`;
      return `${s}}`;
    })
    .join(",");
  return `{"type":"newOrder","params":{"accountID":${accountID},"orders":[${ordersStr}]}}`;
}

export function buildOrderParams(
  accountID: number,
  orders: SpotOrderItem[],
): Record<string, unknown> {
  return {
    accountID,
    orders: orders.map((o) => {
      const item: Record<string, unknown> = {
        symbolID: o.symbolID,
        clOrdID: o.clOrdID,
        side: o.side,
        type: o.type,
        timeInForce: o.timeInForce,
        quantity: o.quantity,
      };
      if (o.price != null && o.price !== "") item.price = o.price;
      return item;
    }),
  };
}

export function payloadHashForOrder(
  accountID: number,
  orders: SpotOrderItem[],
): `0x${string}` {
  return keccak256(toBytes(buildCompactPayload(accountID, orders)));
}

/** EIP-712 typed data for MetaMask / wallet (master wallet — no API key). */
export function walletSignTypedData(
  accountID: number,
  orders: SpotOrderItem[],
  nonce: number,
) {
  const payloadHash = payloadHashForOrder(accountID, orders);
  return {
    domain: SPOT_DOMAIN,
    types: SPOT_SIGN_TYPES,
    primaryType: "ExchangeAction" as const,
    message: {
      payloadHash,
      nonce: BigInt(nonce),
    },
  };
}

export async function signSpotOrderWithPrivateKey(
  accountID: number,
  orders: SpotOrderItem[],
  privateKey: `0x${string}`,
  nonce: number,
): Promise<string> {
  const payloadHash = payloadHashForOrder(accountID, orders);
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signTypedData({
    domain: SPOT_DOMAIN,
    types: SPOT_SIGN_TYPES,
    primaryType: "ExchangeAction",
    message: {
      payloadHash,
      nonce: BigInt(nonce),
    },
  });
  return `0x01${signature.slice(2)}`;
}

/** vBTC_vUSDC → https://testnet.sodex.com/trade/spot/BTC_USDC */
export function spotTradeUrl(apiSymbol: string): string {
  const [rawBase, rawQuote = "USDC"] = apiSymbol.split("_");
  const base = rawBase.replace(/^v/, "");
  const quote = rawQuote.replace(/^v/, "");
  return `https://testnet.sodex.com/trade/spot/${base}_${quote}`;
}