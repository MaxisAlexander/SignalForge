import {
  releaseSosoRequest,
  throttleSosoRequest,
  with429Backoff,
} from "./soso-rate-limit";

const BASE = "https://openapi.sosovalue.com/openapi/v1";

/** Next.js fetch cache for identical URLs (seconds). */
const FETCH_REVALIDATE_SEC = 300;

export class SosoApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "SosoApiError";
  }
}

function getApiKey(): string {
  const key = process.env.SOSO_API_KEY;
  if (!key) {
    throw new SosoApiError(
      "SOSO_API_KEY is not set. Add it to .env.local from sosovalue.com/developer/dashboard",
    );
  }
  return key;
}

export async function sosoFetch<T>(
  path: string,
  params?: Record<string, string | number>,
): Promise<T> {
  return with429Backoff(async () => {
    await throttleSosoRequest();
    try {
      const url = new URL(`${BASE}${path}`);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, String(v));
        }
      }

      const res = await fetch(url.toString(), {
        headers: { "x-soso-api-key": getApiKey() },
        next: { revalidate: FETCH_REVALIDATE_SEC },
      });

      if (!res.ok) {
        throw new SosoApiError(
          `SoSoValue HTTP ${res.status} for ${path}`,
          res.status,
        );
      }

      const json = (await res.json()) as {
        code: number;
        message?: string;
        msg?: string;
        data: T;
      };

      if (json.code !== 0) {
        throw new SosoApiError(json.message ?? json.msg ?? `API error on ${path}`);
      }

      return json.data;
    } finally {
      releaseSosoRequest();
    }
  });
}

/** Optional endpoint — returns fallback on failure (no retries). */
export async function sosoFetchOptional<T>(
  path: string,
  params: Record<string, string | number> | undefined,
  fallback: T,
): Promise<T> {
  try {
    return await sosoFetch<T>(path, params);
  } catch (e) {
    if (e instanceof SosoApiError && e.status === 429) {
      throw e;
    }
    return fallback;
  }
}