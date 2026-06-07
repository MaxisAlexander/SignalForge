import { NextRequest, NextResponse } from "next/server";
import { fetchAccountState } from "@/lib/sodex-testnet";

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Valid address required" }, { status: 400 });
    }
    const state = await fetchAccountState(address);
    return NextResponse.json({ ...state, address });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Account fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}