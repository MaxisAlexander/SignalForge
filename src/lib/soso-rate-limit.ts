import { SosoApiError } from "./sosovalue";

/** Minimum gap between any SoSoValue Open API request. */
const MIN_GAP_MS = 450;

/** Only one retry on 429, with a long backoff. */
const MAX_429_RETRIES = 1;

let lastRequestAt = 0;
let inFlight = 0;
const MAX_CONCURRENT = 1;

export async function throttleSosoRequest(): Promise<void> {
  while (inFlight >= MAX_CONCURRENT) {
    await sleep(100);
  }
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_GAP_MS) {
    await sleep(MIN_GAP_MS - elapsed);
  }
  lastRequestAt = Date.now();
  inFlight += 1;
}

export function releaseSosoRequest() {
  inFlight = Math.max(0, inFlight - 1);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function with429Backoff<T>(
  fn: (attempt: number) => Promise<T>,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (e) {
      const is429 = e instanceof SosoApiError && e.status === 429;
      if (!is429 || attempt >= MAX_429_RETRIES) throw e;
      const waitSec = 8 * (attempt + 1);
      await sleep(waitSec * 1000);
      attempt += 1;
    }
  }
}