/** Safely parse a fetch Response body as JSON (handles empty / non-JSON). */
export async function readJson<T = Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status}).`);
    }
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      !res.ok
        ? `Request failed (${res.status}).`
        : "Server returned invalid JSON.",
    );
  }
}
