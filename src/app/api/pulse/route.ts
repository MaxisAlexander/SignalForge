import { NextResponse } from "next/server";
import { fetchMarketPulse } from "@/lib/signal-engine";
import {
  canFetchLivePulse,
  getCachedPulse,
  getPulseCacheAgeMs,
  msUntilNextFetch,
  PULSE_CACHE_TTL_MS,
  setCachedPulse,
} from "@/lib/pulse-cache";
import { SosoApiError } from "@/lib/sosovalue";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const cached = getCachedPulse();

    if (cached && (!force || !canFetchLivePulse())) {
      const age = getPulseCacheAgeMs() ?? 0;
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": `private, max-age=${Math.floor(PULSE_CACHE_TTL_MS / 1000)}`,
          "X-SignalForge-Cache": "hit",
          "X-SignalForge-Cache-Age-Ms": String(age),
        },
      });
    }

    if (!canFetchLivePulse()) {
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            "X-SignalForge-Cache": "hit-rate-limit",
            "X-SignalForge-Retry-After-Ms": String(msUntilNextFetch()),
          },
        });
      }
      return NextResponse.json(
        {
          error: `SoSoValue rate protection: wait ${Math.ceil(msUntilNextFetch() / 1000)}s before scanning again.`,
        },
        { status: 429 },
      );
    }

    const pulse = await fetchMarketPulse();
    setCachedPulse(pulse);
    return NextResponse.json(pulse, {
      headers: {
        "Cache-Control": `private, max-age=${Math.floor(PULSE_CACHE_TTL_MS / 1000)}`,
        "X-SignalForge-Cache": "miss",
      },
    });
  } catch (e) {
    const cached = getCachedPulse();
    if (cached && e instanceof SosoApiError && e.status === 429) {
      return NextResponse.json(
        {
          ...cached,
          warnings: [
            ...(cached.warnings ?? []),
            "Serving cached scan — SoSoValue rate limit. Wait before re-scanning.",
          ],
        },
        {
          headers: { "X-SignalForge-Cache": "stale-429" },
        },
      );
    }
    const message = e instanceof SosoApiError ? e.message : "Failed to fetch market pulse";
    const status = e instanceof SosoApiError && e.status === 429 ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}