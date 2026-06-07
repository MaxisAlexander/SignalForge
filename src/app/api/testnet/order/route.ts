import { NextRequest, NextResponse } from "next/server";
import { submitSpotOrder } from "@/lib/sodex-testnet";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      params: Record<string, unknown>;
      apiKey?: string;
      sign: string;
      nonce: string;
    };
    if (!body.params || !body.sign || !body.nonce) {
      return NextResponse.json({ error: "Missing order fields" }, { status: 400 });
    }
    const aid = Number(
      (body.params as { accountID?: number }).accountID ?? 0,
    );
    if (!aid || aid <= 0) {
      return NextResponse.json(
        {
          error:
            "accountID must be > 0. On testnet.sodex.com: claim faucet, transfer to Spot, then Refresh account.",
        },
        { status: 400 },
      );
    }

    const result = await submitSpotOrder(body.params, {
      apiKey: body.apiKey,
      sign: body.sign,
      nonce: body.nonce,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Order submit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}