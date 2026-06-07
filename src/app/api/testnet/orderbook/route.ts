import { NextRequest, NextResponse } from "next/server";
import { fetchOrderBook } from "@/lib/sodex-testnet";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol");
    if (!symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 });
    }
    const book = await fetchOrderBook(symbol);
    return NextResponse.json(book);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Orderbook fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}