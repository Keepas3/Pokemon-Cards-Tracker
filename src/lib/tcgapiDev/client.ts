// Shared tcgapi.dev request helper. Both the card price checker
// (cardPricing/tcgapiDev.ts) and the set browser (sets/) go through here, so
// every call — whoever makes it — updates one picture of the free tier's
// ~100 requests/day budget.
const BASE_URL = "https://api.tcgapi.dev/v1";

export interface TcgApiRateLimit {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  /** When the daily budget refills (UTC midnight), if the API said. */
  resetAt: Date | null;
}

// globalThis, not a module variable: in `next dev` the scheduler and route
// handlers can end up with separate copies of this module.
const g = globalThis as unknown as { __tcgApiRateLimit?: TcgApiRateLimit };

/** Last budget the API reported, or null if unknown / already past its reset time. */
export function getTcgApiRateLimit(): TcgApiRateLimit | null {
  const rl = g.__tcgApiRateLimit;
  if (!rl) return null;
  if (rl.resetAt && rl.resetAt.getTime() <= Date.now()) return null;
  return rl;
}

function remember(raw: { daily_limit?: number; daily_remaining?: number; daily_reset?: string } | undefined) {
  if (!raw) return;
  g.__tcgApiRateLimit = {
    dailyLimit: typeof raw.daily_limit === "number" ? raw.daily_limit : null,
    dailyRemaining: typeof raw.daily_remaining === "number" ? raw.daily_remaining : null,
    resetAt: raw.daily_reset ? new Date(raw.daily_reset) : null,
  };
}

export type TcgApiResult<T> = { ok: true; json: T } | { ok: false; error: string };

/**
 * The API reports errors two ways: a plain string (`{"error":"..."}`) and an
 * object (`{"error":{"message":"...","code":"INVALID_API_KEY"}}`, e.g. for a
 * bad key). Pull readable text out of either.
 */
export function errorText(error: unknown): string | null {
  if (typeof error === "string") return error || null;
  if (error && typeof error === "object") {
    const { message } = error as { message?: unknown };
    if (typeof message === "string" && message) return message;
  }
  return null;
}

/** GET `${BASE_URL}${path}` with the API key; degrades every failure to a clear error. */
export async function tcgApiFetch<T>(path: string): Promise<TcgApiResult<T>> {
  const apiKey = process.env.TCGAPI_DEV_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "TCGAPI_DEV_API_KEY is not set — get a free key at tcgapi.dev" };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers: { "X-API-Key": apiKey, Accept: "application/json" } });
  } catch (err) {
    return { ok: false, error: `network error: ${(err as Error).message}` };
  }

  let json: { error?: unknown; rate_limit?: Parameters<typeof remember>[0] } & T;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `tcgapi.dev returned ${res.status} with a non-JSON body` };
  }

  remember(json.rate_limit);

  if (!res.ok) {
    const detail = errorText(json.error);
    return { ok: false, error: detail ? `tcgapi.dev: ${detail}` : `tcgapi.dev returned ${res.status}` };
  }

  return { ok: true, json };
}
