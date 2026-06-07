import { NextResponse } from "next/server";
import { analyzeFromPulse } from "@/lib/signal-engine";
import {
  canFetchLivePulse,
  getCachedPulse,
  setCachedPulse,
} from "@/lib/pulse-cache";
import { fetchMarketPulse } from "@/lib/signal-engine";
import type { FocusPreset, MarketPulse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      focus?: FocusPreset;
      query?: string;
      pulse?: MarketPulse;
      /** When true, prefer a live SoSoValue pulse before analyzing (never stale-only). */
      fresh?: boolean;
    };
    const focus = body.focus ?? "btc-macro";

    let pulse: MarketPulse | null = body.pulse ?? null;

    if (body.fresh) {
      if (canFetchLivePulse()) {
        pulse = await fetchMarketPulse();
        setCachedPulse(pulse);
      } else {
        pulse = getCachedPulse() ?? pulse;
      }
    } else {
      pulse = pulse ?? getCachedPulse();
    }

    if (!pulse) {
      return NextResponse.json(
        {
          error:
            "No scan data available. Run Step 1 Scan first, then Analyze again.",
        },
        { status: 400 },
      );
    }

    const result = await analyzeFromPulse(pulse, focus, body.query);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-SignalForge-Cache": body.fresh ? "analyze-fresh" : "analyze-local",
        "X-SignalForge-Analyzed-At": result.analyzedAt,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}