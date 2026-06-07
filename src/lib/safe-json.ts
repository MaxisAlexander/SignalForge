export async function parseJsonResponse<T = unknown>(
  res: Response,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: false, error: `Empty response (HTTP ${res.status})`, status: res.status };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    const hint = text.trimStart().startsWith("<!")
      ? "Server returned HTML — restart with: npm run dev:clean"
      : text.slice(0, 120);
    return {
      ok: false,
      error: `Invalid JSON (HTTP ${res.status}): ${hint}`,
      status: res.status,
    };
  }
}