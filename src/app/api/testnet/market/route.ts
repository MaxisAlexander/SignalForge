import { NextRequest, NextResponse } from "next/server";
import { fetchTestnetTicker, symbolForSignal } from "@/lib/sodex-testnet";

export async function GET(req: NextRequest) {
  try {
    const ssi = req.nextUrl.searchParams.get("ssi") ?? undefined;
    const symbol =
      req.nextUrl.searchParams.get("symbol") ?? symbolForSignal(ssi ?? undefined);
    const ticker = await fetchTestnetTicker(symbol);
    return NextResponse.json({ symbol, ticker });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Testnet market fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}