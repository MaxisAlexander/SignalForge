import { NextRequest, NextResponse } from "next/server";
import { fetchSpotSymbol, fetchTestnetTicker, symbolForSignal } from "@/lib/sodex-testnet";

export async function GET(req: NextRequest) {
  try {
    const ssi = req.nextUrl.searchParams.get("ssi") ?? undefined;
    const symbol =
      req.nextUrl.searchParams.get("symbol") ??
      symbolForSignal(ssi ?? undefined);
    const [meta, ticker] = await Promise.all([
      fetchSpotSymbol(symbol),
      fetchTestnetTicker(symbol),
    ]);
    return NextResponse.json({ symbol, meta, ticker });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Symbol fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}