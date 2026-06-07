import type { MarketPulse } from "./types";

/** How long cached pulse is served without calling SoSoValue. */
export const PULSE_CACHE_TTL_MS = 5 * 60 * 1000;

/** Minimum wait between live SoSoValue pulse fetches (protects API key). */
export const PULSE_MIN_REFETCH_MS = 2 * 60 * 1000;

let cache: { pulse: MarketPulse; at: number } | null = null;
let lastLiveFetchAt = 0;

export function getCachedPulse(): MarketPulse | null {
  if (!cache) return null;
  if (Date.now() - cache.at > PULSE_CACHE_TTL_MS) {
    cache = null;
    return null;
  }
  return cache.pulse;
}

export function setCachedPulse(pulse: MarketPulse) {
  cache = { pulse, at: Date.now() };
  lastLiveFetchAt = Date.now();
}

/** Clears in-memory pulse so the next scan/analyze cannot reuse stale server data. */
export function invalidatePulseCache() {
  cache = null;
}

export function getPulseCacheAgeMs(): number | null {
  if (!cache) return null;
  return Date.now() - cache.at;
}

export function canFetchLivePulse(): boolean {
  if (!lastLiveFetchAt) return true;
  return Date.now() - lastLiveFetchAt >= PULSE_MIN_REFETCH_MS;
}

export function msUntilNextFetch(): number {
  if (!lastLiveFetchAt) return 0;
  return Math.max(0, PULSE_MIN_REFETCH_MS - (Date.now() - lastLiveFetchAt));
}